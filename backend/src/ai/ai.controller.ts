import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { HelpdeskAccountGuard } from '../auth/guards/helpdesk-account.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AiService } from './ai.service';
import { AiChatRequestDto } from './dto/ai-chat.dto';
import { AiDailyRateLimitGuard } from './guards/ai-daily-rate-limit.guard';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';
import { Role } from '../../generated/prisma/client';

// AI ticket intake is a customer-facing entry point, same restriction as
// POST /tickets -- an agent/admin filing a ticket on someone else's
// behalf via chat isn't supported yet (tracked as a possible future item:
// agent-assisted ticket creation with a customer picker, not scheduled).
@UseGuards(JwtAuthGuard, HelpdeskAccountGuard, RolesGuard)
@Roles(Role.CUSTOMER)
@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('chat')
  @UseGuards(AiDailyRateLimitGuard)
  chat(@Req() req: AuthenticatedRequest, @Body() dto: AiChatRequestDto) {
    return this.aiService.chat(req.user.userId, dto.messages);
  }

  // Read-only usage check -- doesn't consume the daily limit itself
  // (no AiDailyRateLimitGuard here), so the frontend (Step 10.6.3) can
  // show "X of Y used today" before the user sends a single message.
  // Passes the caller's IP through so the response can reflect whichever
  // of the per-user/per-IP caps (see AiDailyRateLimitGuard) is actually
  // tighter right now -- see AiService.getUsage's own comment.
  @Get('usage')
  usage(@Req() req: AuthenticatedRequest) {
    return this.aiService.getUsage(req.user.userId, req.ip ?? 'unknown');
  }
}
