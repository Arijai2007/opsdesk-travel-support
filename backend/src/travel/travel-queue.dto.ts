import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PRIORITIES, STATUSES } from './travel.rules';

export class TravelQueueDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page?: number;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  search?: string;

  @IsOptional()
  @IsIn(['active', 'waiting', 'resolved', 'mine', 'all'])
  tab?: string;

  @IsOptional()
  @IsIn(['1'])
  attention?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: string;

  @IsOptional()
  @IsIn(['ASIA', 'EUROPE', 'AMERICAS'])
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  owner?: string;

  @IsOptional()
  @IsIn(['OVERDUE', 'NEXT_DAY'])
  deadline?: string;
}
