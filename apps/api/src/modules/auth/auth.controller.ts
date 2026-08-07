import { Controller, Post, Get, Body, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Authenticate user and set refresh token cookie' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res() res: Response) {
    await this.authService.checkRateLimit(`login:${req.ip}:${dto?.email || ''}`, 10, 60);

    const result = await this.authService.login(dto, req.ip);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
      message: 'Login successful',
    });
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user account' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const user = await this.authService.register(dto, req.ip);
    return {
      success: true,
      data: user,
      message: 'User registered successfully',
    };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh cookie' })
  async refresh(@Req() req: Request, @Res() res: Response) {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'NO_REFRESH_TOKEN', message: 'Refresh token missing' },
      });
    }

    const result = await this.authService.refreshToken(token);

    // Set rotated refresh cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset token' })
  async forgotPassword(@Body('email') email: string, @Req() req: Request) {
    await this.authService.checkRateLimit(`forgot_pwd:${req.ip}`, 5, 60);
    const result = await this.authService.forgotPassword(email);
    return result;
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(@Req() req: Request, @Body('token') token: string, @Body('password') password?: string) {
    await this.authService.checkRateLimit(`reset_pwd:${req.ip}`, 5, 60);
    const result = await this.authService.resetPassword(token, password);
    return result;
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verify email with OTP' })
  async verifyEmail(@Req() req: Request, @Res() res: Response, @Body('email') email?: string, @Body('code') code?: string) {
    await this.authService.checkRateLimit(`verify_email:${req.ip}`, 10, 60);
    if (code && email) {
      const result = await this.authService.verifyOtp(email, 'email', code);
      return res.status(200).json(result);
    }
    return res.status(200).json({
      success: true,
      message: 'Email verified successfully.',
    });
  }

  @Post('verify-phone')
  @ApiOperation({ summary: 'Verify phone number with SMS OTP' })
  async verifyPhone(@Req() req: Request, @Res() res: Response, @Body('phone') phone?: string, @Body('code') code?: string) {
    await this.authService.checkRateLimit(`verify_phone:${req.ip}`, 10, 60);
    if (code && phone) {
      const result = await this.authService.verifyOtp(phone, 'phone', code);
      return res.status(200).json(result);
    }
    return res.status(200).json({
      success: true,
      message: 'Phone verified successfully.',
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  async me(@CurrentUser('id') userId: string) {
    const user = await this.authService.me(userId);
    return {
      success: true,
      data: user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiOperation({ summary: 'Log out current user' })
  async logout(@CurrentUser('id') userId: string, @Req() req: Request, @Res() res: Response) {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    await this.authService.logout(userId, token);

    res.clearCookie('refreshToken');
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  }
}
