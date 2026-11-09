import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';
import { TravelService } from './travel.service';
import {
  AvailabilityDto,
  ConversationStatusDto,
  ClockDto,
  NewConversationDto,
  NewTravelTicketDto,
  SupplierReplyDto,
  TravelMessageDto,
  UpdateTravelTicketDto,
} from './travel.dto';
@Controller('ops')
@UseGuards(JwtAuthGuard)
export class TravelController {
  constructor(private readonly travel: TravelService) {}
  @Get('workspace') workspace(@Req() req: AuthenticatedRequest) {
    return this.travel.workspace(req.user.userId);
  }
  @Post('tickets') create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: NewTravelTicketDto,
  ) {
    return this.travel.create(req.user.userId, dto);
  }
  @Patch('tickets/:id') update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateTravelTicketDto,
  ) {
    return this.travel.update(req.user.userId, id, dto);
  }
  @Post('tickets/:id/messages') message(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: TravelMessageDto,
  ) {
    return this.travel.message(req.user.userId, id, dto);
  }
  @Post('tickets/:id/conversations') conversation(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: NewConversationDto,
  ) {
    return this.travel.conversation(req.user.userId, id, dto);
  }
  @Post('conversations/:id/reply') reply(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SupplierReplyDto,
  ) {
    return this.travel.reply(req.user.userId, id, dto);
  }
  @Patch('conversations/:id') conversationStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ConversationStatusDto,
  ) {
    return this.travel.conversationStatus(req.user.userId, id, dto.status);
  }
  @Post('clock/advance') clock(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ClockDto,
  ) {
    return this.travel.advance(req.user.userId, dto.minutes);
  }
  @Patch('availability') availability(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AvailabilityDto,
  ) {
    return this.travel.availability(req.user.userId, dto.available);
  }
}
