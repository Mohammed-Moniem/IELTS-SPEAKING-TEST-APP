import { LoginRequest, RefreshTokenRequest, RegisterRequest } from '@dto/AuthDto';
import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { userRepository } from '@lib/db/repositories';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@lib/auth/token';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { SubscriptionPlan, UserDocument } from '@models/UserModel';
import { PasswordResetTokenModel } from '@models/PasswordResetTokenModel';
import { EmailVerificationTokenModel } from '@models/EmailVerificationTokenModel';
import { referralService } from '@services/ReferralService';
import { PartnerProgramService } from '@services/PartnerProgramService';
import { EmailService } from '@services/EmailService';
import { Service } from 'typedi';
import crypto from 'crypto';

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: UserDocument;
}

@Service()
export class AuthService {
  private log = new Logger(__filename);

  constructor(
    private readonly partnerProgramService: PartnerProgramService,
    private readonly emailService: EmailService
  ) {}

  public async register(payload: RegisterRequest, headers: IRequestHeaders): Promise<AuthResult> {
    const logMessage = constructLogMessage(__filename, 'register', headers);
    this.log.info(`${logMessage} :: Attempting to register user ${payload.email}`);

    const existingUser = await userRepository.findByEmail(payload.email);
    if (existingUser) {
      throw new CSError(HTTP_STATUS_CODES.CONFLICT, CODES.UserAlreadyExists, 'Email already registered');
    }

    const normalizedReferral = payload.referralCode?.trim().toUpperCase();
    const normalizedPartnerCode = payload.partnerCode?.trim().toUpperCase();

    // Create user and handle referral redemption atomically
    let createdUser: UserDocument | null = null;
    try {
      createdUser = await userRepository.create({
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

      if (normalizedPartnerCode) {
        await this.partnerProgramService.recordAttributionTouch({
          code: normalizedPartnerCode,
          source: 'register',
          userId: createdUser._id.toString(),
          email: payload.email,
          strict: true
        });
      }
    } catch (error: any) {
      if (createdUser) {
        await userRepository.deleteById(createdUser._id.toString());
      }

      if (normalizedReferral || normalizedPartnerCode) {
        throw new CSError(
          HTTP_STATUS_CODES.BAD_REQUEST,
          CODES.InvalidBody,
          error?.message || 'Unable to apply referral or partner code'
        );
      }

      throw error;
    }

    if (!createdUser) {
      throw new CSError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, CODES.GenericErrorMessage, 'Registration failed');
    }

    const sanitizedUser = await userRepository.findById(createdUser._id.toString());
    const tokens = this.generateTokens(sanitizedUser!);

    await this.appendRefreshToken(createdUser._id.toString(), tokens.refreshToken);

    // Send welcome email and verification email (fire-and-forget)
    void this.emailService.sendWelcome(createdUser.email, createdUser.firstName);
    void this.sendVerificationEmail(createdUser._id.toString(), headers);

    return {
      ...tokens,
      user: sanitizedUser!
    };
  }

  public async login(payload: LoginRequest, headers: IRequestHeaders): Promise<AuthResult> {
    const logMessage = constructLogMessage(__filename, 'login', headers);
    this.log.info(`${logMessage} :: Login attempt ${payload.email}`);

    const user = await userRepository.findByEmailWithSecrets(payload.email);
    if (!user) {
      throw new CSError(HTTP_STATUS_CODES.UNAUTHORIZED, CODES.InvalidCredentials, 'Invalid credentials');
    }

    const passwordMatches = await user.comparePassword(payload.password);
    if (!passwordMatches) {
      throw new CSError(HTTP_STATUS_CODES.UNAUTHORIZED, CODES.InvalidCredentials, 'Invalid credentials');
    }

    const now = new Date();
    await userRepository.updateOne({ _id: user._id.toString() }, { $set: { lastLoginAt: now } });
    user.lastLoginAt = now;

    const sanitizedUser = await userRepository.findById(user._id.toString());
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
    const user = await userRepository.findByIdWithRefreshTokens(decoded.sub);

    if (!user) {
      throw new CSError(HTTP_STATUS_CODES.UNAUTHORIZED, CODES.NotAuthorized, 'Invalid refresh token');
    }

    if (!user.refreshTokens.includes(payload.refreshToken)) {
      throw new CSError(HTTP_STATUS_CODES.UNAUTHORIZED, CODES.RefreshTokenRevoked, 'Refresh token revoked');
    }

    const tokens = this.generateTokens(user);

    await this.rotateRefreshToken(user, payload.refreshToken, tokens.refreshToken);

    const sanitizedUser = await userRepository.findById(user._id.toString());

    return {
      ...tokens,
      user: sanitizedUser!
    };
  }

  public async logout(refreshToken: string, headers: IRequestHeaders): Promise<void> {
    const decoded = verifyRefreshToken(refreshToken);
    await userRepository.updateOne({ _id: decoded.sub }, { $pull: { refreshTokens: refreshToken } });

    const logMessage = constructLogMessage(__filename, 'logout', headers);
    this.log.info(`${logMessage} :: Refresh token revoked`);
  }

  /**
   * Generate a time-limited password reset token and send reset email.
   * Always returns void to prevent email enumeration.
   */
  public async forgotPassword(email: string, headers: IRequestHeaders): Promise<void> {
    const logMessage = constructLogMessage(__filename, 'forgotPassword', headers);
    this.log.info(`${logMessage} :: Password reset requested for ${email}`);

    const user = await userRepository.findByEmail(email);
    if (!user) {
      // Silently succeed to prevent email enumeration
      this.log.info(`${logMessage} :: No user found for ${email}, silently succeeding`);
      return;
    }

    // Invalidate any existing reset tokens for this user
    await PasswordResetTokenModel.updateMany(
      { userId: user._id.toString(), used: false },
      { $set: { used: true } }
    );

    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');

    await PasswordResetTokenModel.create({
      userId: user._id.toString(),
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    });

    await this.emailService.sendPasswordReset(user.email, plainToken, user.firstName);
  }

  /**
   * Validate a password reset token and update the user's password.
   */
  public async resetPassword(token: string, newPassword: string, headers: IRequestHeaders): Promise<void> {
    const logMessage = constructLogMessage(__filename, 'resetPassword', headers);
    this.log.info(`${logMessage} :: Password reset attempt`);

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resetToken = await PasswordResetTokenModel.findOne({
      tokenHash,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!resetToken) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidToken, 'Invalid or expired reset token');
    }

    const user = await userRepository.findByEmail(
      (await userRepository.findById(resetToken.userId))?.email || ''
    );
    if (!user) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'User not found');
    }

    // Mark token as used
    resetToken.used = true;
    await resetToken.save();

    // Update password — the pre-save hook in UserModel hashes it
    user.password = newPassword;
    await user.save();

    // Revoke all refresh tokens to force re-login everywhere
    await userRepository.updateOne({ _id: user._id.toString() }, { $set: { refreshTokens: [] } });

    this.log.info(`${logMessage} :: Password reset successful for user ${user._id}`);
  }

  /**
   * Send an email verification link to the user.
   */
  public async sendVerificationEmail(userId: string, headers: IRequestHeaders): Promise<void> {
    const logMessage = constructLogMessage(__filename, 'sendVerificationEmail', headers);
    this.log.info(`${logMessage} :: Sending verification email for user ${userId}`);

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'User not found');
    }

    if (user.emailVerified) {
      this.log.info(`${logMessage} :: Email already verified for ${user.email}`);
      return;
    }

    // Invalidate existing verification tokens
    await EmailVerificationTokenModel.updateMany(
      { userId: user._id.toString(), used: false },
      { $set: { used: true } }
    );

    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');

    await EmailVerificationTokenModel.create({
      userId: user._id.toString(),
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    await this.emailService.sendEmailVerification(user.email, plainToken, user.firstName);
  }

  /**
   * Verify a user's email address using a verification token.
   */
  public async verifyEmail(token: string, headers: IRequestHeaders): Promise<void> {
    const logMessage = constructLogMessage(__filename, 'verifyEmail', headers);
    this.log.info(`${logMessage} :: Email verification attempt`);

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const verificationToken = await EmailVerificationTokenModel.findOne({
      tokenHash,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!verificationToken) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidToken, 'Invalid or expired verification token');
    }

    // Mark token as used
    verificationToken.used = true;
    await verificationToken.save();

    await userRepository.updateOne(
      { _id: verificationToken.userId },
      { $set: { emailVerified: true } }
    );

    this.log.info(`${logMessage} :: Email verified for user ${verificationToken.userId}`);
  }

  private generateTokens(user: UserDocument) {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      plan: user.subscriptionPlan,
      roles: user.adminRoles || []
    };

    return {
      accessToken: generateAccessToken(payload),
      refreshToken: generateRefreshToken(payload)
    };
  }

  private async appendRefreshToken(userId: string, refreshToken: string) {
    await userRepository.updateOne(
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
    await userRepository.updateOne({ _id: user._id.toString() }, { $pull: { refreshTokens: oldToken } });

    // Then add new token
    await userRepository.updateOne({ _id: user._id.toString() }, { $addToSet: { refreshTokens: newToken } });

    // Enforce storage limit to prevent unbounded growth
    // Re-fetch user to get updated refreshTokens array
    const updatedUser = await userRepository.findByIdWithRefreshTokens(user._id.toString());
    if (updatedUser && (updatedUser.refreshTokens?.length || 0) > 10) {
      await userRepository.updateOne(
        { _id: user._id.toString() },
        { $set: { refreshTokens: updatedUser.refreshTokens.slice(-10) } }
      );
    }
  }
}
