import {
  Allow,
  IsOptional,
  IsISO8601,
  Matches,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
export class CalendarPolicyDto {
  @Allow() calendar: unknown;
  @IsString() @MinLength(3) @MaxLength(1000) reason: string;
}
export class SlaPauseDto {
  @IsBoolean() paused: boolean;
  @IsString() @MinLength(3) @MaxLength(1000) reason: string;
}
export class EscalationOwnerDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z$/)
  overrideUntil?: string | null;
  @Allow() ownerId: unknown;
  @IsString() @MinLength(3) @MaxLength(1000) reason: string;
}

export class HandoffPolicyDto {
  @IsBoolean() enabled: boolean;
  @IsString() @MinLength(3) @MaxLength(1000) reason: string;
}

export class SupplierCalendarDto extends CalendarPolicyDto {
  @IsInt() @Min(1) @Max(168) responseTargetHours: number;
}
