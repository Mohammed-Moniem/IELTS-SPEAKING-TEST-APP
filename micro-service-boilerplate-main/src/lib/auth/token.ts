import { env } from '@env';
import jwt from 'jsonwebtoken';

export interface TokenPayload {
  sub: string;
  email: string;
  scope?: string[];
  plan?: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}

const signToken = (payload: TokenPayload, secret: string, expiresIn: string) => {
  return jwt.sign(payload, secret, {
    expiresIn: expiresIn as any,
    issuer: env.app.name
  });
};

export const generateAccessToken = (payload: TokenPayload) => {
  return signToken(payload, env.jwt.accessSecret, env.jwt.accessExpiresIn);
};

export const generateRefreshToken = (payload: TokenPayload) => {
  return signToken(payload, env.jwt.refreshSecret, env.jwt.refreshExpiresIn);
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.jwt.accessSecret, {
    issuer: env.app.name
  }) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.jwt.refreshSecret, {
    issuer: env.app.name
  }) as TokenPayload;
};
