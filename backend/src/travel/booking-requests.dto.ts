import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
export class CreateBookingRequestDto {
  @IsUUID() requestId: string;
  @IsString() @MaxLength(100) agencyId: string;
  @IsString() @MaxLength(100) customerId: string;
  @IsString() @MaxLength(100) supplierId: string;
  @IsString() @MinLength(2) @MaxLength(80) reference: string;
  @IsString() @MinLength(2) @MaxLength(150) destination: string;
  @IsIn(['ASIA', 'EUROPE', 'AMERICAS']) region: string;
  @IsString() @MinLength(2) @MaxLength(100) service: string;
  @IsISO8601({ strict: true }) checkInAt: string;
  @IsOptional() @IsISO8601({ strict: true }) departureAt?: string;
  @IsOptional() @IsISO8601({ strict: true }) cancellationCutoffAt?: string;
  @IsString() @MaxLength(80) timezone: string;
  @IsString() @MinLength(10) @MaxLength(1000) reason: string;
}
export class CancelBookingRequestDto {
  @IsUUID() requestId: string;
  @IsString() @MinLength(10) @MaxLength(1000) reason: string;
}
export class ReviewBookingRequestDto {
  @IsIn(['APPROVED', 'REJECTED']) decision: string;
  @IsString() @MinLength(10) @MaxLength(1000) reason: string;
}
