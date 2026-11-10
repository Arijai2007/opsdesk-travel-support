import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SupplierCalendarDto } from './sla.dto';
import { TravelPageDto } from './travel-page.dto';

export class ContractPolicyDto extends SupplierCalendarDto {
  @IsString() @MinLength(3) @MaxLength(100) name: string;
  @IsBoolean() active: boolean;
}

export class ContractDirectoryDto extends TravelPageDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsString() @MaxLength(100) agencyId?: string;
  @IsOptional() @IsIn(['1']) includeInactive?: string;
}
