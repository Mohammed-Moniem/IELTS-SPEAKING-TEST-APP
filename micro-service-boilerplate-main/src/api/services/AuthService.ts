import {
  GuestSessionRequest,
  LoginRequest,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  RefreshTokenRequest,
  RegisterRequest,
  UpgradeGuestRequest
} from '@dto/AuthDto';
import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@lib/auth/token';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { PasswordResetTokenModel } from '@models/PasswordResetTokenModel';
import { SubscriptionPlan, UserDocument, UserModel } from '@models/UserModel';
import { referralService } from '@services/ReferralService';
import { Service } from 'typedi';
import { randomBytes, createHash } from 'crypto';

import { EmailService } from './EmailService';

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: UserDocument;
}

@Service()
export class AuthService {
  private log = new Logger(__filename);

  constructor(private readonly emailService: EmailService) {}

  public async register(payload: RegisterRequest, headers: IRequestHeaders): Promise<AuthResult> {
    const logMessage = constructLogMessage(__filename, 'register', headers);
    this.log.info(`${logMessage} :: Attempting to register user ${payload.email}`);

    const existingUser = await UserModel.findOne({ email: payload.email });
    if (existingUser) {
      throw new CSError(HTTP_STATUS_CODES.CONFLICT, CODES.UserAlreadyExists, 'Email already registered');
    }

    const normalizedReferral = payload.referralCode?.trim().toUpperCase();

    // Create user and handle referral redemption atomically
    let createdUser: UserDocument | null = null;
    try {
      createdUser = await UserModel.create({
        email: payload.email,
        phone: payload.phone,
        firstName: payload.firstName,
        lastName: payload.lastName,
        password: payload.password,
        subscriptionPlan: 'free' as SubscriptionPlan
      });

      if (normalizedReferral) {
        await referralService.redeemReferralCode(normalizedReferral, createdUser._id.toString(), payload.email);
      }
    } catch (error: any) {
      if (createdUser) {
        await UserModel.deleteOne({ _id: createdUser._id });
      }

      if (normalizedReferral) {
        throw new CSError(
          HTTP_STATUS_CODES.BAD_REQUEST,
          CODES.InvalidBody,
          error?.message || 'Unable to apply referral code'
        );
      }

      throw error;
    }

    if (!createdUser) {
      throw new CSError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, CODES.GenericErrorMessage, 'Registration failed');
    }

    const sanitizedUser = await UserModel.findById(createdUser._id);
    const tokens = this.generateTokens(sanitizedUser!);

    await this.appendRefreshToken(createdUser._id.toString(), tokens.refreshToken);

    return {
      ...tokens,
      user: sanitizedUser!
    };
  }

  public async login(payload: LoginRequest, headers: IRequestHeaders): Promise<AuthResult> {
    const logMessage = constructLogMessage(__filename, 'login', headers);
    this.log.info(`${logMessage} :: Login attempt ${payload.email}`);

    const user = await UserModel.findOne({ email: payload.email }).select('+password +refreshTokens');
    if (!user) {
      throw new CSError(HTTP_STATUS_CODES.UNAUTHORIZED, CODES.InvalidCredentials, 'Invalid credentials');
    }

    const passwordMatches = await user.comparePassword(payload.password);
    if (!passwordMatches) {
      throw new CSError(HTTP_STATUS_CODES.UNAUTHORIZED, CODES.InvalidCredentials, 'Invalid credentials');
    }

    user.lastLoginAt = new Date();
    await user.save();

    const sanitizedUser = await UserModel.findById(user._id);
    const tokens = this.generateTokens(user);

    await this.appendRefreshToken(user._id.toString(), tokens.refreshToken);

    return {
      ...tokens,
      user: sanitizedUser!
    };
  }

  public async refreshTokens(payload: RefreshTokenRequest, headers: IRequestHeaders): Promise<AuthResult> {
    const logMessage = constructLogMessage(__filename, 'refreshTokens', headers);
    this.log.info(`${logMessage} :: Refresh token requested`);

    const decoded = verifyRefreshToken(payload.refreshToken);
    const user = await UserModel.findById(decoded.sub).select('+refreshTokens');

    if (!user) {
      throw new CSError(HTTP_STATUS_CODES.UNAUTHORIZED, CODES.NotAuthorized, 'Invalid refresh token');
    }

    if (!user.refreshTokens.includes(payload.refreshToken)) {
      throw new CSError(HTTP_STATUS_CODES.UNAUTHORIZED, CODES.RefreshTokenRevoked, 'Refresh token revoked');
    }

    const tokens = this.generateTokens(user);

    await this.rotateRefreshToken(user, payload.refreshToken, tokens.refreshToken);

    const sanitizedUser = await UserModel.findById(user._id);

    return {
      ...tokens,
      user: sanitizedUser!
    };
  }

  public async logout(refreshToken: string, headers: IRequestHeaders): Promise<void> {
    const decoded = verifyRefreshToken(refreshToken);
    await UserModel.updateOne({ _id: decoded.sub }, { $pull: { refreshTokens: refreshToken } });

    const logMessage = constructLogMessage(__filename, 'logout', headers);
    this.log.info(`${logMessage} :: Refresh token revoked`);
  }

  private generateTokens(user: UserDocument, options?: { scope?: string[] }) {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      plan: user.subscriptionPlan,
      scope: options?.scope && options.scope.length ? options.scope : undefined
    };

    return {
      accessToken: generateAccessToken(payload),
      refreshToken: generateRefreshToken(payload)
    };
  }

  public async guestSession(payload: GuestSessionRequest, headers: IRequestHeaders): Promise<AuthResult> {
    const logMessage = constructLogMessage(__filename, 'guestSession', headers);
    const deviceId = payload.deviceId?.trim();
    if (!deviceId) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'deviceId is required');
    }

    // Keep the identifier reasonably bounded to avoid pathological email/DB key sizes.
    const normalizedDeviceId = deviceId.slice(0, 128);

    const existing = await UserModel.findOne({ guestDeviceId: normalizedDeviceId }).select('+refreshTokens');
    let user: UserDocument;
    if (existing) {
      user = existing;
      if (!user.isGuest) {
        // If a previous guest was upgraded, they should no longer be addressable via guestDeviceId.
        user.isGuest = true;
      }
      user.lastLoginAt = new Date();
      await user.save();
      this.log.info(`${logMessage} :: Reusing guest user ${user._id}`);
    } else {
      const emailSafeId = normalizedDeviceId.replace(/[^a-zA-Z0-9._-]/g, '-');
      const email = `guest+${emailSafeId}@trial.local`.toLowerCase();
      const password = `Guest!${randomBytes(16).toString('hex')}`;

      try {
        user = await UserModel.create({
          email,
          phone: undefined,
          firstName: 'Guest',
          lastName: 'User',
          password,
          subscriptionPlan: 'free' as SubscriptionPlan,
          isGuest: true,
          guestDeviceId: normalizedDeviceId
        });
      } catch (error: any) {
        // Handle concurrent guest-session calls racing to create the same guest.
        // Unique constraints (email) can throw duplicate key errors (11000).
        if (error?.code === 11000) {
          const after =
            (await UserModel.findOne({ guestDeviceId: normalizedDeviceId }).select('+refreshTokens')) ||
            (await UserModel.findOne({ email }).select('+refreshTokens'));
          if (!after) {
            throw error;
          }
          user = after as UserDocument;
        } else {
          throw error;
        }
      }

      // Re-fetch to ensure password/refreshTokens are excluded and transforms apply consistently.
      user = (await UserModel.findById(user._id).select('+refreshTokens')) as UserDocument;
      this.log.info(`${logMessage} :: Created new guest user ${user._id}`);
    }

    const sanitizedUser = (await UserModel.findById(user._id)) as UserDocument;
    const tokens = this.generateTokens(user, { scope: ['guest'] });

    await this.appendRefreshToken(user._id.toString(), tokens.refreshToken);

    return {
      ...tokens,
      user: sanitizedUser!
    };
  }

  public async upgradeGuest(userId: string, payload: UpgradeGuestRequest, headers: IRequestHeaders): Promise<AuthResult> {
    const logMessage = constructLogMessage(__filename, 'upgradeGuest', headers);

    const user = await UserModel.findById(userId).select('+refreshTokens');
    if (!user) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'User not found');
    }

    if (!user.isGuest) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'User is not a guest');
    }

    const email = payload.email.trim().toLowerCase();
    const existingEmail = await UserModel.findOne({ email });
    if (existingEmail && existingEmail._id.toString() !== userId) {
      throw new CSError(HTTP_STATUS_CODES.CONFLICT, CODES.UserAlreadyExists, 'Email already registered');
    }

    user.email = email;
    if (payload.firstName && payload.firstName.trim()) {
      user.firstName = payload.firstName.trim();
    }
    if (payload.lastName && payload.lastName.trim()) {
      user.lastName = payload.lastName.trim();
    }
    if (payload.phone !== undefined) {
      user.phone = payload.phone?.trim() || undefined;
    }
    user.password = payload.password;
    user.isGuest = false;
    user.guestDeviceId = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    // Invalidate existing refresh tokens (guest tokens) and issue a fresh pair.
    await UserModel.updateOne({ _id: user._id }, { $set: { refreshTokens: [] } });

    const refreshedUser = (await UserModel.findById(user._id).select('+refreshTokens')) as UserDocument;
    const sanitizedUser = (await UserModel.findById(user._id)) as UserDocument;
    const tokens = this.generateTokens(refreshedUser);
    await this.appendRefreshToken(user._id.toString(), tokens.refreshToken);

    this.log.info(`${logMessage} :: Guest upgraded to registered user ${user._id}`);

    return {
      ...tokens,
      user: sanitizedUser!
    };
  }

  public async requestPasswordReset(payload: PasswordResetRequest, headers: IRequestHeaders): Promise<void> {
    const logMessage = constructLogMessage(__filename, 'requestPasswordReset', headers);
    const email = payload.email.trim().toLowerCase();

    const user = await UserModel.findOne({ email });
    // Avoid account enumeration: always return success.
    if (!user) {
      this.log.info(`${logMessage} :: Password reset requested for unknown email`);
      return;
    }

    // Remove existing tokens for this user to keep one active token at a time.
    await PasswordResetTokenModel.deleteMany({ user: user._id });

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await PasswordResetTokenModel.create({
      user: user._id,
      tokenHash,
      expiresAt
    });

    const scheme = (process.env.PASSWORD_RESET_DEEP_LINK_SCHEME || 'spokio').trim() || 'spokio';
    const resetLink = `${scheme}://reset-password?token=${encodeURIComponent(rawToken)}`;

    await this.emailService.sendPasswordResetEmail({ to: email, resetLink }, headers);
    this.log.info(`${logMessage} :: Password reset token issued`);
  }

  public async confirmPasswordReset(payload: PasswordResetConfirmRequest, headers: IRequestHeaders): Promise<void> {
    const logMessage = constructLogMessage(__filename, 'confirmPasswordReset', headers);
    const rawToken = payload.token.trim();
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const record = await PasswordResetTokenModel.findOne({ tokenHash });
    if (!record) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Invalid or expired reset token');
    }

    if (record.expiresAt <= new Date()) {
      await PasswordResetTokenModel.deleteOne({ _id: record._id });
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Invalid or expired reset token');
    }

    const user = await UserModel.findById(record.user).select('+refreshTokens');
    if (!user) {
      await PasswordResetTokenModel.deleteOne({ _id: record._id });
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'User not found');
    }

    user.password = payload.newPassword;
    await user.save();

    // Invalidate all refresh tokens on password reset.
    await UserModel.updateOne({ _id: user._id }, { $set: { refreshTokens: [] } });

    await PasswordResetTokenModel.deleteOne({ _id: record._id });
    this.log.info(`${logMessage} :: Password reset completed for user ${user._id}`);
  }

  private async appendRefreshToken(userId: string, refreshToken: string) {
    await UserModel.updateOne(
      { _id: userId },
      {
        $addToSet: {
          refreshTokens: refreshToken
        }
      }
    );
  }

  private async rotateRefreshToken(user: UserDocument, oldToken: string, newToken: string) {
    // Remove old token first (if it exists)
    await UserModel.updateOne({ _id: user._id }, { $pull: { refreshTokens: oldToken } });

    // Then add new token
    await UserModel.updateOne({ _id: user._id }, { $addToSet: { refreshTokens: newToken } });

    // Enforce storage limit to prevent unbounded growth
    // Re-fetch user to get updated refreshTokens array
    const updatedUser = await UserModel.findById(user._id).select('+refreshTokens');
    if (updatedUser && (updatedUser.refreshTokens?.length || 0) > 10) {
      await UserModel.updateOne({ _id: user._id }, { $set: { refreshTokens: updatedUser.refreshTokens.slice(-10) } });
    }
  }
}
