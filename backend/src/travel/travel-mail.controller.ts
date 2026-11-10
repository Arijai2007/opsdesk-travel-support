import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';
import { TravelMailService } from './travel-mail.service';

@Controller('ops/mail')
@UseGuards(JwtAuthGuard)
export class TravelMailController {
  constructor(private readonly mail: TravelMailService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.mail.list(req.user.userId);
  }

  @Post(':id/retry')
  retry(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.mail.change(req.user.userId, id, 'retry');
  }

  @Post(':id/cancel')
  cancel(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.mail.change(req.user.userId, id, 'cancel');
  }
}
