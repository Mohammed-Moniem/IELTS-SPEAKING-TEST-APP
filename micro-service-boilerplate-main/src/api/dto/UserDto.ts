import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateProfileRequest {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @Matches(/^[0-9+()\-\s]{6,20}$/, { message: 'Phone number must be valid' })
  phone?: string;
}
