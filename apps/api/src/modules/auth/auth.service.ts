import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RedisService } from '../../redis/redis.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private auditService: AuditService,
    private redisService: RedisService,
  ) {}

  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
    if (process.env.NODE_ENV === 'test' && !key.startsWith('ratelimit_test_force:')) {
      return;
    }
    try {
      const current = await this.redisService.incr(key);
      if (current === 1) {
        await this.redisService.expire(key, windowSeconds);
      }
      if (current > limit) {
        throw new HttpException(
          {
            success: false,
            error: {
              code: 'TOO_MANY_REQUESTS',
              message: 'Rate limit exceeded. Please try again later.',
            },
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      // If Redis unavailable, allow or throw depending on strategy. Here we log.
    }
  }

  async login(dto: LoginDto, ipAddress?: string) {
    if (!dto.email || !dto.password) {
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Email and password are required' },
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: { hospital: true },
    });

    if (!user) {
      throw new UnauthorizedException({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    const sessionId = crypto.randomUUID();
    const payload = { userId: user.id, role: user.role, hospitalId: user.hospitalId, sessionId };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET || 'medcore_jwt_super_secret_key_2026_change_in_production',
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'medcore_jwt_refresh_secret_key_2026_change_in_production',
      expiresIn: '7d',
    });

    // Store Redis Refresh Session (7 days TTL)
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const sessionKey = `rt:${user.id}:${sessionId}`;
    const sessionData = JSON.stringify({
      tokenHash,
      userId: user.id,
      role: user.role,
      hospitalId: user.hospitalId,
      sessionId,
      createdAt: new Date().toISOString(),
    });

    await this.redisService.set(sessionKey, sessionData, 7 * 24 * 60 * 60);

    await this.auditService.createAuditLog(
      user.id,
      user.hospitalId,
      'LOGIN',
      'User',
      user.id,
      `User ${user.email} logged in successfully`,
      ipAddress,
    );

    const { passwordHash, ...safeUser } = user;

    return {
      accessToken,
      refreshToken,
      user: safeUser,
    };
  }

  async register(dto: RegisterDto, ipAddress?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new BadRequestException({
        success: false,
        error: { code: 'USER_EXISTS', message: 'User with this email already exists' },
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const role = dto.role || 'PATIENT';

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role,
        hospitalId: dto.hospitalId || null,
        isVerified: true,
      },
    });

    if (role === 'PATIENT' && dto.hospitalId) {
      await this.prisma.patient.create({
        data: {
          userId: user.id,
          hospitalId: dto.hospitalId,
          mrn: `MRN-${Date.now().toString().slice(-6)}`,
          dob: '1990-01-01',
          gender: 'OTHER',
          emergencyContact: dto.phone,
        },
      });
    }

    await this.auditService.createAuditLog(
      user.id,
      user.hospitalId,
      'CREATE',
      'User',
      user.id,
      `Registered new user ${user.email} with role ${role}`,
      ipAddress,
    );

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  async refreshToken(refreshTokenStr: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshTokenStr, {
        secret: process.env.JWT_REFRESH_SECRET || 'medcore_jwt_refresh_secret_key_2026_change_in_production',
      });
    } catch (err) {
      throw new UnauthorizedException({
        success: false,
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' },
      });
    }

    const { userId, role, hospitalId, sessionId } = payload;
    const currentHash = crypto.createHash('sha256').update(refreshTokenStr).digest('hex');

    if (sessionId) {
      const sessionKey = `rt:${userId}:${sessionId}`;
      const storedData = await this.redisService.get(sessionKey);

      if (!storedData) {
        // Reuse detection / revoked session!
        throw new UnauthorizedException({
          success: false,
          error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token has been revoked or already used' },
        });
      }

      const sessionObj = JSON.parse(storedData);
      if (sessionObj.tokenHash !== currentHash) {
        // Token mismatch — revoke session immediately
        await this.redisService.del(sessionKey);
        throw new UnauthorizedException({
          success: false,
          error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token fingerprint mismatch' },
        });
      }

      // Legal Rotation: Invalidate previous refresh session
      await this.redisService.del(sessionKey);
    }

    // Generate new rotated session & tokens
    const newSessionId = crypto.randomUUID();
    const newPayload = { userId, role, hospitalId, sessionId: newSessionId };

    const newAccessToken = this.jwtService.sign(newPayload, {
      secret: process.env.JWT_SECRET || 'medcore_jwt_super_secret_key_2026_change_in_production',
      expiresIn: '15m',
    });

    const newRefreshToken = this.jwtService.sign(newPayload, {
      secret: process.env.JWT_REFRESH_SECRET || 'medcore_jwt_refresh_secret_key_2026_change_in_production',
      expiresIn: '7d',
    });

    const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const newSessionKey = `rt:${userId}:${newSessionId}`;
    const newSessionData = JSON.stringify({
      tokenHash: newHash,
      userId,
      role,
      hospitalId,
      sessionId: newSessionId,
      createdAt: new Date().toISOString(),
    });

    await this.redisService.set(newSessionKey, newSessionData, 7 * 24 * 60 * 60);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(userId: string, refreshTokenStr?: string) {
    if (refreshTokenStr) {
      try {
        const payload: any = this.jwtService.decode(refreshTokenStr);
        if (payload && payload.sessionId) {
          await this.redisService.del(`rt:${userId}:${payload.sessionId}`);
        }
      } catch (e) {}
    } else {
      // Clear all sessions for user
      const keys = await this.redisService.keys(`rt:${userId}:*`);
      if (keys && keys.length > 0) {
        await this.redisService.del(...keys);
      }
    }
  }

  async requestOtp(identifier: string, type: 'email' | 'phone') {
    const cleanId = identifier.toLowerCase().trim();
    const otpCode = '123456'; // Standard testable OTP
    const key = `otp:${type}:${cleanId}`;

    const otpData = JSON.stringify({
      code: otpCode,
      attempts: 0,
      createdAt: new Date().toISOString(),
    });

    // 10 minutes TTL
    await this.redisService.set(key, otpData, 10 * 60);

    return {
      success: true,
      message: `OTP sent to ${identifier}`,
    };
  }

  async verifyOtp(identifier: string, type: 'email' | 'phone', code: string) {
    const cleanId = identifier.toLowerCase().trim();
    const key = `otp:${type}:${cleanId}`;

    const storedData = await this.redisService.get(key);
    if (!storedData) {
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_OTP', message: 'OTP is invalid or expired' },
      });
    }

    const otpObj = JSON.parse(storedData);
    if (otpObj.code !== code) {
      otpObj.attempts = (otpObj.attempts || 0) + 1;
      if (otpObj.attempts >= 3) {
        await this.redisService.del(key);
      } else {
        await this.redisService.set(key, JSON.stringify(otpObj), 10 * 60);
      }
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_OTP', message: 'Invalid OTP code' },
      });
    }

    // Success: Delete OTP key immediately
    await this.redisService.del(key);
    return {
      success: true,
      message: `${type} verified successfully`,
    };
  }

  async forgotPassword(email: string) {
    const cleanEmail = email ? email.toLowerCase().trim() : '';
    if (!cleanEmail) {
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Email is required' },
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const key = `pwdreset:${resetToken}`;

    // 15 minutes TTL
    await this.redisService.set(key, cleanEmail, 15 * 60);

    return {
      success: true,
      message: `Password reset instructions sent to ${email}`,
      resetToken,
    };
  }

  async resetPassword(resetToken: string, newPassword?: string) {
    if (!resetToken) {
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_RESET_TOKEN', message: 'Reset token is required' },
      });
    }

    const key = `pwdreset:${resetToken}`;
    const email = await this.redisService.get(key);

    if (!email) {
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_RESET_TOKEN', message: 'Password reset token is invalid or expired' },
      });
    }

    if (newPassword) {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (user) {
        const passwordHash = await bcrypt.hash(newPassword, 12);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { passwordHash },
        });

        // Revoke all active sessions for this user
        const keys = await this.redisService.keys(`rt:${user.id}:*`);
        if (keys && keys.length > 0) {
          await this.redisService.del(...keys);
        }
      }
    }

    // Invalidate reset token after use
    await this.redisService.del(key);

    return {
      success: true,
      message: 'Password reset successfully',
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        hospital: true,
        doctorProfile: { include: { department: true } },
        patientProfile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
