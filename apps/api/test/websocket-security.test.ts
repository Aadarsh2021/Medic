import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationsGateway } from '../src/modules/notifications/notifications.gateway';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

/**
 * WEBSOCKET & REALTIME SECURITY TEST SUITE
 * Exercises NestJS NotificationsGateway, JWT handshake authentication,
 * tenant room authorization, and cross-tenant event isolation.
 */
describe('WEBSOCKET: Authentication & Realtime Cross-Tenant Isolation Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let gateway: NotificationsGateway;

  let hospitalAUserToken: string;
  let hospitalBUserToken: string;
  let userAId: string;
  let userBId: string;
  let hospitalAId: string;
  let hospitalBId: string;
  let createdUserBId: string | null = null;

  async function loginAs(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'Password123!' });
    return res.body.data?.accessToken;
  }

  function mockSocket(token?: string): any {
    const rooms = new Set<string>();
    const emittedEvents: { event: string; data: any }[] = [];
    let disconnected = false;

    return {
      handshake: {
        auth: { token },
        headers: {},
        query: {},
      },
      data: {},
      join: (room: string) => {
        rooms.add(room);
      },
      leave: (room: string) => {
        rooms.delete(room);
      },
      emit: (event: string, data: any) => {
        emittedEvents.push({ event, data });
      },
      disconnect: (force?: boolean) => {
        disconnected = true;
      },
      _rooms: rooms,
      _emittedEvents: emittedEvents,
      _isDisconnected: () => disconnected,
    };
  }

  beforeAll(async () => {
    jest.setTimeout(30000);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    gateway = app.get<NotificationsGateway>(NotificationsGateway);

    // Resolve Hospital A User
    const userA = await prisma.user.findUnique({ where: { email: 'dr.sharma@medcore.org' } });
    userAId = userA!.id;
    hospitalAId = userA!.hospitalId!;

    // Resolve or Create Hospital B (Apex Health) User
    let hospB = await prisma.hospital.findUnique({ where: { code: 'APEX-HEALTH' } });
    if (!hospB) {
      hospB = await prisma.hospital.create({
        data: {
          name: 'Apex Healthcare Centre',
          code: 'APEX-HEALTH',
          address: '45 Care Boulevard',
          phone: '+91 80 4112 8888',
          email: 'info@apexhealth.org',
          status: 'VERIFIED',
        },
      });
    }

    let userB = await prisma.user.findUnique({ where: { email: 'dr.apex@apexhealth.org' } });
    if (!userB) {
      const passwordHash = await bcrypt.hash('Password123!', 4);
      userB = await prisma.user.create({
        data: {
          email: 'dr.apex@apexhealth.org',
          passwordHash,
          firstName: 'Apex',
          lastName: 'Doctor',
          phone: '+91 98888 77777',
          role: 'DOCTOR',
          hospitalId: hospB.id,
          isVerified: true,
        },
      });
      createdUserBId = userB.id;
    }

    userBId = userB.id;
    hospitalBId = hospB.id;

    hospitalAUserToken = await loginAs('dr.sharma@medcore.org');
    hospitalBUserToken = await loginAs('dr.apex@apexhealth.org');

    expect(hospitalAId).not.toBe(hospitalBId);
  });

  afterAll(async () => {
    if (createdUserBId) {
      await prisma.user.delete({ where: { id: createdUserBId } }).catch(() => {});
    }
    await app.close();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // A & B: Unauthenticated & Invalid Handshake Rejection
  // ─────────────────────────────────────────────────────────────────────────────

  test('A. Connection without JWT is rejected / disconnected', async () => {
    const socket = mockSocket(); // No token
    await gateway.handleConnection(socket);

    expect(socket._isDisconnected()).toBe(true);
    const errEvent = socket._emittedEvents.find((e: any) => e.event === 'exception');
    expect(errEvent).toBeDefined();
    expect(errEvent.data.message).toContain('Authentication required');
  });

  test('B. Connection with invalid/garbage JWT is rejected / disconnected', async () => {
    const socket = mockSocket('invalid_garbage_jwt_token_12345');
    await gateway.handleConnection(socket);

    expect(socket._isDisconnected()).toBe(true);
    const errEvent = socket._emittedEvents.find((e: any) => e.event === 'exception');
    expect(errEvent).toBeDefined();
    expect(errEvent.data.message).toContain('Invalid or expired');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // C: Authenticated Handshake & Auto Room Joining
  // ─────────────────────────────────────────────────────────────────────────────

  test('C. Authenticated Hospital A user connects successfully & joins user/hospital rooms', async () => {
    const socket = mockSocket(hospitalAUserToken);
    await gateway.handleConnection(socket);

    expect(socket._isDisconnected()).toBe(false);
    expect(socket.data.user).toBeDefined();
    expect(socket.data.user.userId).toBe(userAId);
    expect(socket.data.user.hospitalId).toBe(hospitalAId);

    // Verify automatically joined user room and hospital room
    expect(socket._rooms.has(`user_${userAId}`)).toBe(true);
    expect(socket._rooms.has(`hospital_${hospitalAId}`)).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // D & E: Room Joining Authorization
  // ─────────────────────────────────────────────────────────────────────────────

  test('D. Hospital A user CANNOT join Hospital B room', async () => {
    const socket = mockSocket(hospitalAUserToken);
    await gateway.handleConnection(socket);

    const response = gateway.handleJoinHospital(socket, hospitalBId);
    expect(response.event).toBe('error');
    expect(response.message).toContain('Forbidden');
    expect(socket._rooms.has(`hospital_${hospitalBId}`)).toBe(false);
  });

  test('E. Authenticated user CAN join own permitted hospital room', async () => {
    const socket = mockSocket(hospitalAUserToken);
    await gateway.handleConnection(socket);

    const response = gateway.handleJoinHospital(socket, hospitalAId);
    expect(response.event).toBe('joined');
    expect(response.room).toBe(`hospital_${hospitalAId}`);
    expect(socket._rooms.has(`hospital_${hospitalAId}`)).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // F & G: Targeted Event Isolation
  // ─────────────────────────────────────────────────────────────────────────────

  test('F. User-targeted notification routes strictly to user room user_{userId}', async () => {
    const mockServer: any = {
      to: jest.fn().mockImplementation((room: string) => ({
        emit: jest.fn().mockImplementation((event: string, payload: any) => ({ room, event, payload })),
      })),
    };
    gateway.server = mockServer;

    gateway.sendNotificationToUser(userAId, { title: 'Private User A Note' });

    expect(mockServer.to).toHaveBeenCalledWith(`user_${userAId}`);
    expect(mockServer.to).not.toHaveBeenCalledWith(`user_${userBId}`);
  });

  test('G. Hospital-scoped broadcast routes strictly to hospital_{hospitalId}', async () => {
    const mockServer: any = {
      to: jest.fn().mockImplementation((room: string) => ({
        emit: jest.fn().mockImplementation((event: string, payload: any) => ({ room, event, payload })),
      })),
    };
    gateway.server = mockServer;

    gateway.sendNotificationToHospital(hospitalAId, { title: 'Hospital A Alert' });

    expect(mockServer.to).toHaveBeenCalledWith(`hospital_${hospitalAId}`);
    expect(mockServer.to).not.toHaveBeenCalledWith(`hospital_${hospitalBId}`);
  });
});
