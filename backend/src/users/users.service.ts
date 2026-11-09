import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { isDemoUserId } from '@helpdesk/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateNameDto } from './dto/update-name.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeEmailDto } from './dto/change-email.dto';
import { PwnedPasswordService } from '../common/services/pwned-password.service';
import { RateLimitService } from '../common/services/rate-limit.service';
import { SessionRevocationService } from '../common/services/session-revocation.service';
import { WeakPasswordException } from '../common/exceptions/weak-password.exception';
import { USERS_ERRORS } from '../common/constants/error-messages.constants';
import { USERS_SUCCESS } from '../common/constants/success-messages.constants';
import { BCRYPT_SALT_ROUNDS } from '../common/constants/auth.constants';
import { ACCOUNT_MUTATION_RATE_LIMIT_WINDOW_SECONDS } from '../common/constants/rate-limit.constants';
import { buildAccountMutationRateLimitKey } from './account-mutation-rate-limit.util';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private pwnedPasswords: PwnedPasswordService,
    private rateLimit: RateLimitService,
    private sessionRevocation: SessionRevocationService,
  ) {}

  /**
   * Finds the ids of a user's currently-active refresh tokens (optionally
   * excluding one, e.g. the session making the request) so callers can
   * revoke them live in Redis right after the DB transaction that flips
   * their `revoked` flag commits. Kept as a single helper since
   * changePassword/changeEmail/deleteAccount all need the same "which
   * sessions am I about to cut off" lookup, just with slightly different
   * scoping.
   */
  private async findActiveRefreshTokenIds(
    userId: string,
    excludeId?: string,
  ): Promise<string[]> {
    const rows = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revoked: false,
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException(USERS_ERRORS.USER_NOT_FOUND);
    return user;
  }

  /**
   * Blocks name/password/email changes and account deletion on the four
   * shared seed accounts (admin@helpdesk.dev / agent@helpdesk.dev /
   * agent2@helpdesk.dev / customer@helpdesk.dev) so the public live demo
   * can't be locked out, deleted, or defaced by a visitor who's logged in
   * with the published credentials. A renamed demo account is immediately
   * visible to the next visitor (e.g. in a "Welcome, ___" header) with no
   * login attempt needed to notice, unlike password/email changes — so
   * it's guarded too, not just the security-sensitive fields. Checked
   * against `@helpdesk/shared`'s DEMO_USERS fixture — the same source of
   * truth `seed.ts` inserts from — rather than an ID naming convention or
   * a DB column, so the frontend can reuse the identical check without a
   * round-trip.
   */
  private assertNotDemoAccount(userId: string): void {
    if (isDemoUserId(userId)) {
      throw new ForbiddenException(USERS_ERRORS.DEMO_ACCOUNT_PROTECTED);
    }
  }

  async updateName(userId: string, dto: UpdateNameDto) {
    this.assertNotDemoAccount(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
      },
      select: { id: true, firstName: true, lastName: true },
    });
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    currentRefreshTokenId: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(USERS_ERRORS.USER_NOT_FOUND);
    this.assertNotDemoAccount(userId);

    const rateLimitKey = buildAccountMutationRateLimitKey(userId);
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      // AccountMutationRateLimitGuard only pre-checks; this is the one
      // place that knows whether the guess was actually right, same split
      // as AuthService.login (see RateLimitService's class comment).
      await this.rateLimit.increment(
        rateLimitKey,
        ACCOUNT_MUTATION_RATE_LIMIT_WINDOW_SECONDS,
      );
      throw new UnauthorizedException(USERS_ERRORS.CURRENT_PASSWORD_INCORRECT);
    }
    // A correct password clears the slate — an earlier typo shouldn't
    // count against the user for the rest of the window once they get it
    // right.
    await this.rateLimit.reset(rateLimitKey);

    const isSameAsCurrent = await bcrypt.compare(
      dto.newPassword,
      user.passwordHash,
    );
    if (isSameAsCurrent) {
      throw new BadRequestException(USERS_ERRORS.NEW_PASSWORD_SAME_AS_CURRENT);
    }

    // Hard blocks (length, complexity, top-1000 list) already ran in the
    // DTO. This is a soft check: warn and require explicit confirmation,
    // but never block on the third-party API being unavailable.
    if (!dto.acknowledgeWeakPassword) {
      const isBreached = await this.pwnedPasswords.check(dto.newPassword);
      if (isBreached) throw new WeakPasswordException();
    }

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);

    // Captured before the transaction: updateMany doesn't return the rows
    // it touched, and we need the ids afterward to also revoke them live
    // in Redis (see SessionRevocationService).
    const idsToRevoke = await this.findActiveRefreshTokenIds(
      userId,
      currentRefreshTokenId,
    );

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: {
          userId,
          id: { not: currentRefreshTokenId },
          revoked: false,
        },
        data: { revoked: true },
      }),
    ]);

    // Best-effort, after the DB commit — see SessionRevocationService for
    // why a Redis failure here doesn't roll back or fail this request.
    await this.sessionRevocation.revokeMany(idsToRevoke);

    return { message: USERS_SUCCESS.PASSWORD_UPDATED };
  }

  async changeEmail(
    userId: string,
    dto: ChangeEmailDto,
    currentRefreshTokenId: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(USERS_ERRORS.USER_NOT_FOUND);
    this.assertNotDemoAccount(userId);

    const rateLimitKey = buildAccountMutationRateLimitKey(userId);
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      await this.rateLimit.increment(
        rateLimitKey,
        ACCOUNT_MUTATION_RATE_LIMIT_WINDOW_SECONDS,
      );
      throw new UnauthorizedException(USERS_ERRORS.CURRENT_PASSWORD_INCORRECT);
    }
    await this.rateLimit.reset(rateLimitKey);

    // Checked before the uniqueness lookup below: without this, resubmitting
    // your own current email would find yourself in that lookup and surface
    // a confusing "email already in use" 409 instead of a clear "unchanged"
    // error. Exact-string comparison, matching the rest of the codebase
    // (no email normalization/lowercasing happens anywhere else either).
    if (dto.newEmail === user.email) {
      throw new BadRequestException(USERS_ERRORS.EMAIL_SAME_AS_CURRENT);
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.newEmail },
    });
    if (existing)
      throw new ConflictException(USERS_ERRORS.EMAIL_ALREADY_IN_USE);

    const idsToRevoke = await this.findActiveRefreshTokenIds(
      userId,
      currentRefreshTokenId,
    );

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { email: dto.newEmail },
      }),
      this.prisma.refreshToken.updateMany({
        where: {
          userId,
          id: { not: currentRefreshTokenId },
          revoked: false,
        },
        data: { revoked: true },
      }),
    ]);

    await this.sessionRevocation.revokeMany(idsToRevoke);

    return { message: USERS_SUCCESS.EMAIL_UPDATED };
  }

  async deleteAccount(userId: string, currentPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(USERS_ERRORS.USER_NOT_FOUND);
    this.assertNotDemoAccount(userId);
    if (await this.prisma.travelProfile.findUnique({ where: { userId } }))
      throw new ForbiddenException(
        'Contact support to close an account with OpsDesk case history.',
      );

    const rateLimitKey = buildAccountMutationRateLimitKey(userId);
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      await this.rateLimit.increment(
        rateLimitKey,
        ACCOUNT_MUTATION_RATE_LIMIT_WINDOW_SECONDS,
      );
      throw new UnauthorizedException(USERS_ERRORS.CURRENT_PASSWORD_INCORRECT);
    }
    // No reset() here on the success path — the account (and thus the key's
    // relevance) is deleted a few lines down anyway, and a Redis key with a
    // 15-minute TTL left keyed to an already-deleted userId is harmless.

    // Unlike changePassword/changeEmail, there's no session to exempt —
    // the account itself is going away, so every session (including the
    // one making this request) needs to stop working immediately.
    // Captured before the transaction since the cascade delete below
    // removes these rows outright, not just flips a flag on them.
    const idsToRevoke = await this.findActiveRefreshTokenIds(userId);

    await this.prisma.$transaction([
      // Anonymize this user's messages before the FK is nulled
      this.prisma.message.updateMany({
        where: { senderId: userId },
        data: { content: '[deleted user]' },
      }),
      // RefreshToken rows cascade automatically via onDelete: Cascade
      // Ticket.customerId / Ticket.agentId / Message.senderId set null via onDelete: SetNull
      this.prisma.user.delete({ where: { id: userId } }),
    ]);

    await this.sessionRevocation.revokeMany(idsToRevoke);

    return { message: USERS_SUCCESS.ACCOUNT_DELETED };
  }
}
