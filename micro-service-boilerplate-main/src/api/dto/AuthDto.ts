import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

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

export class GuestSessionRequest {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  deviceId!: string;
}

export class UpgradeGuestRequest {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*]).+$/, {
    message: 'Password must include upper, lower, number, and special character'
  })
  password!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @Matches(/^[A-Z0-9]{4,20}$/, {
    message: 'Referral code must be 4-20 characters using uppercase letters or numbers'
  })
  referralCode?: string;
}

export class PasswordResetRequest {
  @IsEmail()
  email!: string;
}

export class PasswordResetConfirmRequest {
  @IsString()
  @MinLength(16)
  @MaxLength(256)
  token!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*]).+$/, {
    message: 'Password must include upper, lower, number, and special character'
  })
  newPassword!: string;
}
