import {
  Allow,
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
  @Allow() ownerId: unknown;
  @IsString() @MinLength(3) @MaxLength(1000) reason: string;
}

export class HandoffPolicyDto {
  @IsBoolean() enabled: boolean;
  @IsString() @MinLength(3) @MaxLength(1000) reason: string;
}
