import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';
import { MembershipService } from './membership.service';
import {
  AcceptInvitationDto,
  InvitationDto,
  MembershipReasonDto,
  MembershipStatusDto,
  NewAgencyDto,
  NewSupplierDto,
} from './membership.dto';
import { TravelDirectoryDto } from './travel-directory.dto';
import { TravelPageDto } from './travel-page.dto';
@Controller('ops/admin')
@UseGuards(JwtAuthGuard)
export class MembershipController {
  constructor(private membership: MembershipService) {}
  @Get('members') members(
    @Req() req: AuthenticatedRequest,
    @Query() query: TravelDirectoryDto,
  ) {
    return this.membership.members(req.user.userId, query);
  }
  @Get('audit') audit(
    @Req() req: AuthenticatedRequest,
    @Query() query: TravelPageDto,
  ) {
    return this.membership.auditPage(req.user.userId, query);
  }
  @Post('invitations') invite(
    @Req() req: AuthenticatedRequest,
    @Body() dto: InvitationDto,
  ) {
    return this.membership.invite(req.user.userId, dto);
  }
  @Post('members/:id/invitation') reissue(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: MembershipReasonDto,
  ) {
    return this.membership.reissue(req.user.userId, id, dto.reason);
  }
  @Patch('members/:id/status') status(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: MembershipStatusDto,
  ) {
    return this.membership.status(req.user.userId, id, dto);
  }
  @Get('agencies') agencies(
    @Req() req: AuthenticatedRequest,
    @Query() query: TravelDirectoryDto,
  ) {
    return this.membership.directory(req.user.userId, 'agency', query);
  }
  @Get('suppliers') suppliers(
    @Req() req: AuthenticatedRequest,
    @Query() query: TravelDirectoryDto,
  ) {
    return this.membership.directory(req.user.userId, 'supplier', query);
  }
  @Post('agencies') agency(
    @Req() req: AuthenticatedRequest,
    @Body() dto: NewAgencyDto,
  ) {
    return this.membership.agency(req.user.userId, dto);
  }
  @Post('suppliers') supplier(
    @Req() req: AuthenticatedRequest,
    @Body() dto: NewSupplierDto,
  ) {
    return this.membership.supplier(req.user.userId, dto);
  }
}
@Controller('ops/invitations')
export class InvitationController {
  constructor(private membership: MembershipService) {}
  @Post('accept')
  @HttpCode(200)
  accept(@Req() req: Request, @Body() dto: AcceptInvitationDto) {
    return this.membership.accept(
      dto,
      req.ip ?? req.socket.remoteAddress ?? 'unknown',
    );
  }
}
