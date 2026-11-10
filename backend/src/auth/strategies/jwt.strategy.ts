import { PrismaService } from '../../../prisma/prisma.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SessionRevocationService } from '../../common/services/session-revocation.service';
import { AUTH_ERRORS } from '../../common/constants/error-messages.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private sessionRevocation: SessionRevocationService,
    private db: PrismaService,
  ) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not set');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: {
    sub: string;
    role: string;
    refreshTokenId: string;
    sessionVersion?: number;
  }) {
    // Signature + exp already passed by the time this runs. This adds a
    // live check against the Redis denylist so a session revoked by a
    // password/email change, logout, or account deletion elsewhere is
    // rejected on its very next request — not just at its next
    // /auth/refresh — see SessionRevocationService for the full rationale.
    const revoked = await this.sessionRevocation.isRevoked(
      payload.refreshTokenId,
    );
    if (revoked) {
      throw new UnauthorizedException(
        AUTH_ERRORS.REFRESH_TOKEN_EXPIRED_OR_REVOKED,
      );
    }

    const membership = await this.db.travelProfile.findUnique({
      where: { userId: payload.sub },
    });
    if (
      membership &&
      (membership.status !== 'ACTIVE' ||
        membership.sessionVersion !== (payload.sessionVersion ?? 0))
    )
      throw new UnauthorizedException(
        AUTH_ERRORS.REFRESH_TOKEN_EXPIRED_OR_REVOKED,
      );
    return {
      userId: payload.sub,
      role: payload.role,
      refreshTokenId: payload.refreshTokenId,
    };
  }
}
