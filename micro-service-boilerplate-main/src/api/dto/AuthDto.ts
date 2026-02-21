import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RegisterRequest {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*]).+$/, {
    message: 'Password must include upper, lower, number, and special character'
  })
  password!: string;

  @IsOptional()
  @Matches(/^[A-Z0-9]{4,20}$/, {
    message: 'Referral code must be 4-20 characters using uppercase letters or numbers'
  })
  referralCode?: string;
}

export class LoginRequest {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class RefreshTokenRequest {
  @IsString()
  refreshToken!: string;
}

export class LogoutRequest {
  @IsString()
  refreshToken!: string;
}
