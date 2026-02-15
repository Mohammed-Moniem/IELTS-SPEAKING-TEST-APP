import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  token!: string;

  @IsOptional()
  @IsIn(['ios', 'android'])
  platform?: 'ios' | 'android';

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsInt()
  timezoneOffsetMinutes?: number;
}

export class UnregisterDeviceDto {
  @IsString()
  token!: string;
}

export class UpdateNotificationSettingsDto {
  @IsBoolean()
  dailyReminderEnabled!: boolean;

  @IsInt()
  @Min(0)
  @Max(23)
  dailyReminderHour!: number;

  @IsInt()
  @Min(0)
  @Max(59)
  dailyReminderMinute!: number;

  @IsBoolean()
  achievementsEnabled!: boolean;

  @IsBoolean()
  streakRemindersEnabled!: boolean;

  @IsBoolean()
  inactivityRemindersEnabled!: boolean;

  @IsBoolean()
  feedbackNotificationsEnabled!: boolean;

  @IsBoolean()
  directMessagesEnabled!: boolean;

  @IsBoolean()
  groupMessagesEnabled!: boolean;

  @IsBoolean()
  systemAnnouncementsEnabled!: boolean;

  @IsBoolean()
  offersEnabled!: boolean;
}

export class BroadcastNotificationDto {
  @IsString()
  title!: string;

  @IsString()
  body!: string;

  @IsIn(['system', 'offer'])
  type!: 'system' | 'offer';

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  userIds?: string[];

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}
