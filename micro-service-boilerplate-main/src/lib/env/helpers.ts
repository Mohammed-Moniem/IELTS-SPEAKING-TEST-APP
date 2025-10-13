import { env } from '@env';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';

export const isEmptyOrNull = (value: any): boolean => {
  if (value === null || value === undefined || value === '') {
    return true;
  }
  if (typeof value === 'object' && Object.keys(value).length === 0) {
    return true;
  }

  if (Array.isArray(value) && value.length === 0) {
    return true;
  }

  if (typeof value === 'number' && isNaN(value)) {
    return true;
  }

  if (!value) {
    return true;
  }

  return false;
};

export const constructLogMessage = (fileName: string, functionName: string, headers: IRequestHeaders): string => {
  let logMessage = `${fileName}, ${functionName} :: `;

  const buildLogMessage = (obj: any, prefix: string = ''): string => {
    let message = '';
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && !Array.isArray(obj[key]) && obj[key] !== null) {
          message += buildLogMessage(obj[key], fullKey);
        } else if (
          key.toLowerCase() !== 'authorization' &&
          !key.toLowerCase().includes('security') &&
          !key.toLowerCase().includes('payload') &&
          !key.toLowerCase().includes('content') &&
          !key.toLowerCase().includes('message') &&
          !key.toLowerCase().includes('body') &&
          !key.toLowerCase().includes('token') &&
          !key.toLowerCase().includes('x')
        ) {
          message += ` :: ${fullKey} :: ${obj[key]}, `;
        }
      }
    }
    return message;
  };

  if (!isEmptyOrNull(headers)) {
    logMessage += buildLogMessage(headers);
  }

  return logMessage;
};

export const getAlgorithmAES256CBC = (base64Key: string): string => {
  const key = Buffer.from(base64Key, 'base64');
  switch (key.length) {
    case 16:
      return 'aes-128-cbc';
    case 24:
      return 'aes-192-cbc';
    case 32:
      return 'aes-256-cbc';
    default:
      throw new Error('Invalid key length ' + key.length);
  }
};

export const encrypt = (plainText: string, base64Key: string, base64IV: string): string => {
  try {
    const crypto = require('crypto');
    const algorithm = getAlgorithmAES256CBC(base64Key);
    const key = Buffer.from(base64Key, 'base64');
    const iv = Buffer.from(base64IV, 'base64');
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
  } catch (error: any) {
    throw new Error(`Error encrypting data: ${error.message}`);
  }
};

export const encryptValue = (plainText: string): string => {
  try {
    const key = env.constants.encryption.key;
    const iv = env.constants.encryption.iv;
    return encrypt(plainText, key, iv);
  } catch (error: any) {
    throw new Error('Something went wrong while encrypting the value' + error.message);
  }
};

export const decrypt = (encryptedText: string, base64Key: string, base64IV: string): string => {
  try {
    const crypto = require('crypto');
    const algorithm = getAlgorithmAES256CBC(base64Key);
    const key = Buffer.from(base64Key, 'base64');
    const iv = Buffer.from(base64IV, 'base64');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error: any) {
    throw new Error(`Error decrypting data: ${error.message}`);
  }
};

export const decryptValue = (encryptedText: string): string => {
  try {
    const key = env.constants.encryption.key;
    const iv = env.constants.encryption.iv;
    return decrypt(encryptedText, key, iv);
  } catch (error: any) {
    throw new Error('Something went wrong while decrypting the value' + error.message);
  }
};
