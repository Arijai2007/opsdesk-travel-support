import {
  IsBoolean,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  Min,
  MinLength,
  ValidateIf,
  ArrayUnique,
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

const UTC_TIMESTAMP = /T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z$/;

export class BookingScheduleDto {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsISO8601({ strict: true })
  @Matches(UTC_TIMESTAMP)
  checkInAt?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(UTC_TIMESTAMP)
  departureAt?: string | null;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(UTC_TIMESTAMP)
  cancellationCutoffAt?: string | null;
}

export class AgentSpecialtiesDto {
  @IsArray()
  @ArrayUnique()
  @IsIn(CATEGORIES, { each: true })
  specialties: string[];
}
