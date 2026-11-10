jest.mock('bcrypt', () => {
  const actual = jest.requireActual<typeof import('bcrypt')>('bcrypt');
  return {
    ...actual,
    hash: jest.fn((value: string, rounds: number) =>
      actual.hash(value, rounds),
    ),
  };
});
jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));
import { chooseAgent } from './travel.rules';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { MembershipService } from './membership.service';
import { AuthService } from '../auth/auth.service';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { RateLimitService } from '../common/services/rate-limit.service';

describe('membership authentication and routing policy', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'membership-unit-test-only';
  });
  it('never routes new work to suspended or invited agents', () => {
    for (const status of ['SUSPENDED', 'INVITED']) {
      expect(
        chooseAgent(
          [{ userId: 'agent', region: 'GLOBAL', available: true, status }],
          'ASIA',
          {},
        ),
      ).toBeUndefined();
    }
  });
  it('rejects suspended members at password login', async () => {
    const passwordHash = await bcrypt.hash('Test-password-42!', 4);
    const db = {
      user: {
        findUnique: () =>
          Promise.resolve({
            id: 'member',
            passwordHash,
            travelProfile: { status: 'SUSPENDED', sessionVersion: 1 },
          }),
      },
    };
    const auth = Reflect.construct(AuthService, [
      db,
      {},
      {},
      {},
      {},
    ]) as AuthService;
    await expect(
      auth.validateUser('member@example.test', 'Test-password-42!'),
    ).rejects.toThrow();
  });
  it('rejects a stale access token after reactivation', async () => {
    const db = {
      travelProfile: {
        findUnique: () =>
          Promise.resolve({ status: 'ACTIVE', sessionVersion: 1 }),
      },
    };
    const strategy = Reflect.construct(JwtStrategy, [
      { isRevoked: () => Promise.resolve(false) },
      db,
    ]) as JwtStrategy;
    await expect(
      strategy.validate({
        sub: 'member',
        role: 'CUSTOMER',
        refreshTokenId: 'session',
      }),
    ).rejects.toThrow();
  });
  it('accepts an unversioned token for a migrated active version-zero member', async () => {
    const db = {
      travelProfile: {
        findUnique: () =>
          Promise.resolve({ status: 'ACTIVE', sessionVersion: 0 }),
      },
    };
    const strategy = Reflect.construct(JwtStrategy, [
      { isRevoked: () => Promise.resolve(false) },
      db,
    ]) as JwtStrategy;
    await expect(
      strategy.validate({
        sub: 'member',
        role: 'CUSTOMER',
        refreshTokenId: 'session',
      }),
    ).resolves.toMatchObject({ userId: 'member' });
  });
});

describe('membership invitation authorization cost', () => {
  it('rejects a non-manager before hashing an invitation password', async () => {
    const tx = {
      $executeRaw: () => Promise.resolve(0),
      travelProfile: {
        findUnique: () =>
          Promise.resolve({ kind: 'CUSTOMER', status: 'ACTIVE' }),
      },
    };
    const db = {
      ...tx,
      $transaction: (fn: (db: unknown) => unknown) => fn(tx),
    };
    const service = Reflect.construct(MembershipService, [
      db,
      {},
    ]) as MembershipService;
    const hash = jest.mocked(bcrypt.hash);
    hash.mockClear();
    await expect(
      service.invite('customer', {
        email: 'member@example.test',
        firstName: 'Member',
        lastName: 'Fixture',
        kind: 'MANAGER',
        reason: 'Regression check',
      }),
    ).rejects.toThrow('Active manager access required.');
    expect(hash).not.toHaveBeenCalled();
  });
});

describe('invitation acceptance quota isolation', () => {
  const password = 'MembershipFixture!2026';
  const ip = '127.0.0.1';
  it('keeps two valid invitations on the same connection IP in independent budgets', async () => {
    const tokenA = 'a'.repeat(64),
      tokenB = 'b'.repeat(64);
    const key = (token: string) =>
      `invitation-accept:${RateLimitService.hashIdentifier(ip)}:${createHash('sha256').update(token).digest('hex')}`;
    const counts = new Map<string, number>([[key(tokenA), 20]]);
    const limits = {
      increment: (name: string) => {
        counts.set(name, (counts.get(name) ?? 0) + 1);
        return Promise.resolve();
      },
      getCount: (name: string) => Promise.resolve(counts.get(name) ?? 0),
    };
    const invitation = {
      id: 'invitation',
      memberId: 'member',
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 3600000),
      member: { status: 'INVITED' },
    };
    const tx = {
      $executeRaw: () => Promise.resolve(0),
      travelInvitation: {
        findUnique: () => Promise.resolve(invitation),
        update: () => Promise.resolve({}),
      },
      user: { update: () => Promise.resolve({}) },
      travelProfile: { update: () => Promise.resolve({}) },
      membershipAudit: { create: () => Promise.resolve({}) },
    };
    const db = {
      ...tx,
      $transaction: (fn: (tx: unknown) => unknown) => fn(tx),
    };
    const service = Reflect.construct(MembershipService, [
      db,
      limits,
    ]) as MembershipService;
    await expect(
      service.accept({ token: tokenA, password }, ip),
    ).rejects.toThrow('Too many invitation attempts.');
    await expect(
      service.accept({ token: tokenB, password }, ip),
    ).resolves.toEqual({ accepted: true });
    expect(counts.get(key(tokenA))).toBe(21);
    expect(counts.get(key(tokenB))).toBe(1);
  });
  it('rejects unknown tokens without allocating counters or hashing passwords', async () => {
    const db = {
      travelInvitation: { findUnique: () => Promise.resolve(null) },
    };
    const limits = {
      increment: jest.fn(() => Promise.resolve()),
      getCount: () => Promise.resolve(0),
    };
    const service = Reflect.construct(MembershipService, [
      db,
      limits,
    ]) as MembershipService;
    const hash = jest.mocked(bcrypt.hash);
    hash.mockClear();
    await expect(
      service.accept({ token: 'c'.repeat(64), password }, ip),
    ).rejects.toThrow('Invitation is invalid or expired.');
    expect(limits.increment).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
  });
});
