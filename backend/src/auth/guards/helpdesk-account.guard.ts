import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.type';

@Injectable()
export class HelpdeskAccountGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (
      await this.prisma.travelProfile.findUnique({
        where: { userId: user.userId },
        select: { userId: true },
      })
    )
      throw new ForbiddenException(
        'Use the OpsDesk workspace for this account.',
      );
    return true;
  }
}
