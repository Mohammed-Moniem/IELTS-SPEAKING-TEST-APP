import { LoginRequest, RefreshTokenRequest, RegisterRequest } from '@dto/AuthDto';
import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@lib/auth/token';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { SubscriptionPlan, UserDocument, UserModel } from '@models/UserModel';
import { Service } from 'typedi';

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: UserDocument;
}

@Service()
export class AuthService {
  private log = new Logger(__filename);

  public async register(payload: RegisterRequest, headers: IRequestHeaders): Promise<AuthResult> {
    const logMessage = constructLogMessage(__filename, 'register', headers);
    this.log.info(`${logMessage} :: Attempting to register user ${payload.email}`);

    const existingUser = await UserModel.findOne({ email: payload.email });
    if (existingUser) {
      throw new CSError(HTTP_STATUS_CODES.CONFLICT, CODES.UserAlreadyExists, 'Email already registered');
    }

    const createdUser = await UserModel.create({
      email: payload.email,
      phone: payload.phone,
      firstName: payload.firstName,
      lastName: payload.lastName,
      password: payload.password,
      subscriptionPlan: 'free' as SubscriptionPlan
    });

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

  private generateTokens(user: UserDocument) {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      plan: user.subscriptionPlan
    };

    return {
      accessToken: generateAccessToken(payload),
      refreshToken: generateRefreshToken(payload)
    };
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
