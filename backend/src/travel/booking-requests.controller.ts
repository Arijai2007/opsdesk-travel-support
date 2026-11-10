import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';
import { BookingRequestsService } from './booking-requests.service';
import {
  CreateBookingRequestDto,
  CancelBookingRequestDto,
  ReviewBookingRequestDto,
} from './booking-requests.dto';
import { TravelPageDto } from './travel-page.dto';
@Controller('ops')
@UseGuards(JwtAuthGuard)
export class BookingRequestsController {
  constructor(private readonly bookings: BookingRequestsService) {}
  @Get('booking-requests') list(
    @Req() req: AuthenticatedRequest,
    @Query() query: TravelPageDto,
  ) {
    return this.bookings.list(req.user.userId, query);
  }
  @Post('booking-requests') create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateBookingRequestDto,
  ) {
    return this.bookings.create(req.user.userId, dto);
  }
  @Post('bookings/:id/cancellation-requests') cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CancelBookingRequestDto,
  ) {
    return this.bookings.cancel(req.user.userId, id, dto);
  }
  @Post('booking-requests/:id/review') review(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ReviewBookingRequestDto,
  ) {
    return this.bookings.review(req.user.userId, id, dto);
  }
}
