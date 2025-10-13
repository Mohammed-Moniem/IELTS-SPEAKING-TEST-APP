import { env } from '@env';
import { constantErrors } from './errorCodeMapping';

// Ensure the prefix always ends with a dot
const errorPrefix = env.errors.errorPrefix || 'SERVICE';
const STANDARD_ERROR_CODE_PREFIX = errorPrefix.endsWith('.') ? errorPrefix : `${errorPrefix}.`;

const { errorCode, errorMessage, errorDescription } = env.errors.default;

export interface StdError {
  code: string;
  message: string;
  description?: string;
}

export const errors = Object.assign({}, constantErrors);

export function toStandardErrorFormat(errCode: string, errObj?: any): StdError {
  let { code, message, description } = errors[errCode] || {
    code: errorCode,
    message: errorMessage,
    description: errorDescription
  };

  code = STANDARD_ERROR_CODE_PREFIX + (code || errCode);

  if (!message) {
    message = (errObj && errObj.message ? errObj.message : JSON.stringify(errObj)) || errCode || errorMessage;
  }

  if (!description) {
    description = (errObj && errObj.description ? errObj.description : message) || errorDescription;
  }

  return { code, message, description: description || message };
}

export function toStandardErrorCode(errCode: string): string {
  // Ensure errCode is a string
  const codeStr = errCode ? String(errCode) : '';

  if (codeStr && codeStr.indexOf(STANDARD_ERROR_CODE_PREFIX) === 0) {
    return codeStr;
  }

  return `${STANDARD_ERROR_CODE_PREFIX}${codeStr || errorCode}`;
}
