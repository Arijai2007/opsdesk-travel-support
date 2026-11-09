import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CATEGORIES, PRIORITIES, STATUSES } from './travel.rules';
export class NewTravelTicketDto {
  @IsString() @MinLength(5) @MaxLength(180) title: string;
  @IsString() @MinLength(10) @MaxLength(10000) description: string;
  @IsOptional() @IsString() @MaxLength(60) bookingReference?: string;
  @IsOptional() @IsString() agencyId?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsIn(CATEGORIES) category?: string;
}
export class UpdateTravelTicketDto {
  @IsOptional() @IsString() @MaxLength(60) bookingReference?: string;
  @IsOptional() @IsIn(STATUSES) status?: string;
  @IsOptional() @IsIn(PRIORITIES) priority?: string;
  @IsOptional() @IsString() agentId?: string;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}
export class TravelMessageDto {
  @IsString() @MinLength(1) @MaxLength(10000) content: string;
  @IsIn(['CUSTOMER', 'INTERNAL']) visibility: string;
}
export class NewConversationDto {
  @IsString() @MinLength(3) @MaxLength(180) subject: string;
  @IsString() @MinLength(1) @MaxLength(10000) content: string;
}
export class SupplierReplyDto {
  @IsString() @MinLength(1) @MaxLength(10000) content: string;
}
export class ClockDto {
  @IsInt() @Min(1) @Max(10080) minutes: number;
}
export class ConversationStatusDto {
  @IsIn(['CLOSED', 'AWAITING_REPLY']) status: string;
}
export class AvailabilityDto {
  @IsBoolean() available: boolean;
}
