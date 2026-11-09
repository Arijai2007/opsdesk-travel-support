import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { TravelPageDto } from './travel-page.dto';
export class TravelDirectoryDto extends TravelPageDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
  @IsOptional()
  @IsIn(['AGENT', 'MANAGER', 'CUSTOMER', 'AGENCY', 'SUPPLIER'])
  kind?: string;
}
