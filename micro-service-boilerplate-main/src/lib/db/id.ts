import { randomBytes } from 'crypto';

const MONGO_STYLE_ID_REGEX = /^[0-9a-f]{24}$/i;

export const isMongoStyleId = (value: unknown): value is string => {
  return typeof value === 'string' && MONGO_STYLE_ID_REGEX.test(value);
};

export const generateMongoStyleId = (): string => {
  // 12 random bytes -> 24-char hex string (Mongo ObjectId-compatible shape)
  return randomBytes(12).toString('hex');
};

export const normalizeMongoStyleId = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return isMongoStyleId(trimmed) ? trimmed.toLowerCase() : undefined;
};
