import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
} from '@helpdesk/shared';
import {
  IsValidName,
  IsStrongPassword,
  IsNotCommonPassword,
  NoEmoji,
} from '../common/validators';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const email = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
export class MembershipReasonDto {
  @Transform(trim)
  @IsString()
  @Length(3, 500)
  reason!: string;
}
export class InvitationDto extends MembershipReasonDto {
  @Transform(email)
  @IsEmail({ allow_display_name: false, require_tld: true })
  @MaxLength(EMAIL_MAX_LENGTH)
  @NoEmoji()
  email!: string;
  @Transform(trim)
  @IsString()
  @Length(NAME_MIN_LENGTH, NAME_MAX_LENGTH)
  @IsValidName()
  firstName!: string;
  @Transform(trim)
  @IsString()
  @Length(NAME_MIN_LENGTH, NAME_MAX_LENGTH)
  @IsValidName()
  lastName!: string;
  @IsIn(['CUSTOMER', 'AGENCY', 'SUPPLIER', 'AGENT', 'MANAGER']) kind!: string;
  @IsOptional() @IsString() @Length(1, 100) agencyId?: string;
  @IsOptional() @IsString() @Length(1, 100) supplierId?: string;
  @IsOptional() @IsIn(['ASIA', 'EUROPE', 'AMERICAS', 'GLOBAL']) region?: string;
}
export class MembershipStatusDto extends MembershipReasonDto {
  @IsIn(['ACTIVE', 'SUSPENDED']) status!: string;
}
export class NewAgencyDto extends MembershipReasonDto {
  @Transform(trim) @IsString() @Length(1, 150) name!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(2, 30)
  @Matches(/^[A-Z0-9_-]+$/)
  code!: string;
}
export class NewSupplierDto extends MembershipReasonDto {
  @Transform(trim) @IsString() @Length(1, 150) name!: string;
  @Transform(email)
  @IsEmail({ allow_display_name: false, require_tld: true })
  @MaxLength(EMAIL_MAX_LENGTH)
  @NoEmoji()
  email!: string;
}
export class AcceptInvitationDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) token!: string;
  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  @NoEmoji()
  @IsStrongPassword()
  @IsNotCommonPassword()
  password!: string;
}
