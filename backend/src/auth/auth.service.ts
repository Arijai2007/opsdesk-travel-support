import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { hashToken, requireEnv } from './token.util';
import { PwnedPasswordService } from '../common/services/pwned-password.service';
import { RateLimitService } from '../common/services/rate-limit.service';
import { SessionRevocationService } from '../common/services/session-revocation.service';
import { WeakPasswordException } from '../common/exceptions/weak-password.exception';
import { AUTH_ERRORS } from '../common/constants/error-messages.constants';
import {
  JWT_ACCESS_EXPIRY,
  JWT_REFRESH_EXPIRY_SECONDS,
  REFRESH_TOKEN_TTL_MS,
  BCRYPT_SALT_ROUNDS,
} from '../common/constants/auth.constants';
import { LOGIN_RATE_LIMIT_WINDOW_SECONDS } from '../common/constants/rate-limit.constants';
import { buildLoginRateLimitKey } from './login-rate-limit.util';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private pwnedPasswords: PwnedPasswordService,
    private rateLimit: RateLimitService,
    private sessionRevocation: SessionRevocationService,
  ) {}

  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    acknowledgeWeakPassword = false,
  ) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException(AUTH_ERRORS.EMAIL_ALREADY_IN_USE);

    // Hard blocks (length, complexity, top-1000 list) already ran in the DTO.
    // This is a soft check: warn and require explicit confirmation, but
    // never block on the third-party API being unavailable.
    if (!acknowledgeWeakPassword) {
      const isBreached = await this.pwnedPasswords.check(password);
      if (isBreached) throw new WeakPasswordException();
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, firstName, lastName },
    });
    return this.issueTokens(user.id, user.role);
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException(AUTH_ERRORS.INVALID_CREDENTIALS);
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException(AUTH_ERRORS.INVALID_CREDENTIALS);
    return user;
  }

  async login(email: string, password: string, ip: string) {
    const rateLimitKey = buildLoginRateLimitKey(email, ip);
    try {
      const user = await this.validateUser(email, password);
      // Successful login clears the slate — an early typo shouldn't count
      // against a user for the rest of the 15-minute window once they get
      // the password right (see RateLimitService's class comment).
      await this.rateLimit.reset(rateLimitKey);
      return this.issueTokens(user.id, user.role);
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        await this.rateLimit.increment(
          rateLimitKey,
          LOGIN_RATE_LIMIT_WINDOW_SECONDS,
        );
      }
      throw err;
    }
  }

  private async issueTokens(
    userId: string,
    role: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    // Sign the refresh token first — its own payload doesn't need the row id
    const refreshToken = this.jwt.sign(
      { sub: userId, jti: randomUUID() },
      {
        secret: requireEnv('JWT_REFRESH_SECRET'),
        expiresIn: JWT_REFRESH_EXPIRY_SECONDS,
      },
    );

    // Create the RefreshToken row BEFORE signing the access token,
    // so we have a row id to embed in the access token payload
    const refreshTokenRow = await db.refreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        userId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    const accessToken = this.jwt.sign(
      { sub: userId, role, refreshTokenId: refreshTokenRow.id },
      { secret: requireEnv('JWT_SECRET'), expiresIn: JWT_ACCESS_EXPIRY },
    );

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: requireEnv('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_REFRESH_TOKEN);
    }

    const tokenHash = hashToken(refreshToken);
    const { previousId, tokens } = await this.prisma.$transaction(async (tx) => {
      const [claimed] = await tx.refreshToken.updateManyAndReturn({
        where: {
          tokenHash,
          userId: payload.sub,
          revoked: false,
          expiresAt: { gt: new Date() },
        },
        data: { revoked: true },
        select: { id: true },
      });
      if (!claimed) {
        throw new UnauthorizedException(
          AUTH_ERRORS.REFRESH_TOKEN_EXPIRED_OR_REVOKED,
        );
      }
      const user = await tx.user.findUniqueOrThrow({
        where: { id: payload.sub },
        select: { id: true, role: true },
      });
      return {
        previousId: claimed.id,
        tokens: await this.issueTokens(user.id, user.role, tx),
      };
    });
    await this.sessionRevocation.revoke(previousId);
    return tokens;
  }

  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    // findUnique (not updateMany) so we have the row id to also revoke in
    // Redis — without it, the paired access token would otherwise stay
    // usable for up to ACCESS_TOKEN_TTL_MS after a "successful" logout.
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!stored) return;

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });
    await this.sessionRevocation.revoke(stored.id);
  }
}
