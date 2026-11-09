import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HelpdeskAccountGuard } from '../auth/guards/helpdesk-account.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { FindTicketsQueryDto } from './dto/find-tickets-query.dto';
import { FindTicketQueueDto } from './dto/find-ticket-queue.dto';
import { CloseTicketDto } from './dto/close-ticket.dto';
import { ReopenTicketDto } from './dto/reopen-ticket.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { TicketCreateRateLimitGuard } from './guards/ticket-create-rate-limit.guard';
import { TicketMessageRateLimitGuard } from './guards/ticket-message-rate-limit.guard';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';
import { Role } from '../../generated/prisma/client';

@UseGuards(JwtAuthGuard, HelpdeskAccountGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  @Post()
  @UseGuards(RolesGuard, TicketCreateRateLimitGuard)
  @Roles(Role.CUSTOMER)
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateTicketDto) {
    return this.ticketsService.create(req.user.userId, dto);
  }

  @Get()
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: FindTicketsQueryDto,
  ) {
    return this.ticketsService.findAllForUser(req.user.userId, query);
  }

  // Registered before ':id' deliberately — Nest/Express match routes in
  // declaration order, and a static segment like 'queue' would otherwise
  // be swallowed by the ':id' param route below it.
  @Get('queue')
  @UseGuards(RolesGuard)
  @Roles(Role.AGENT, Role.ADMIN)
  queue(@Req() req: AuthenticatedRequest, @Query() query: FindTicketQueueDto) {
    return this.ticketsService.findQueue(req.user.userId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.ticketsService.findOneForUser(
      id,
      req.user.userId,
      req.user.role as Role,
    );
  }

  @Patch(':id/close')
  close(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CloseTicketDto,
  ) {
    return this.ticketsService.closeTicket(id, req.user.userId, dto);
  }

  @Patch(':id/reopen')
  reopen(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: ReopenTicketDto,
  ) {
    return this.ticketsService.reopenTicket(id, req.user.userId, dto);
  }

  @Patch(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(Role.AGENT, Role.ADMIN)
  assign(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: AssignTicketDto,
  ) {
    return this.ticketsService.assignTicket(
      id,
      req.user.userId,
      req.user.role as Role,
      dto,
    );
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.AGENT, Role.ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.ticketsService.updateTicketStatus(
      id,
      req.user.userId,
      req.user.role as Role,
      dto,
    );
  }

  @Post(':id/messages')
  @UseGuards(TicketMessageRateLimitGuard)
  addMessage(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateMessageDto,
  ) {
    return this.ticketsService.addMessage(
      id,
      req.user.userId,
      req.user.role as Role,
      dto,
    );
  }

  @Get(':id/messages')
  getMessages(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.ticketsService.getMessages(
      id,
      req.user.userId,
      req.user.role as Role,
    );
  }
}
