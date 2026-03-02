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

  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{4,32}$/, {
    message: 'Partner code must be 4-32 characters using letters, numbers, _ or -'
  })
  partnerCode?: string;
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

export class ForgotPasswordRequest {
  @IsEmail()
  email!: string;
}

export class ResetPasswordRequest {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*]).+$/, {
    message: 'Password must include upper, lower, number, and special character'
  })
  password!: string;
}

export class VerifyEmailRequest {
  @IsString()
  token!: string;
}

export class SendVerificationRequest {
  @IsEmail()
  email!: string;
}
