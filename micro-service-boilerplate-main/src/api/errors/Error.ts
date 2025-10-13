import { env } from '@env';
import { HttpError } from 'routing-controllers';
import { StdError, errors } from './errorCodes';

export class Error extends HttpError {
  public code: string;
  public description?: string;

  constructor(httpCode: number, code: string, message?: string, description?: string) {
    super(httpCode, message);
    this.description = description;
    this.code = code;
  }

  public static createError(httpCode: number, errorCode: string): Error {
    const { code, message, description } = errors[errorCode] || {
      code: `${env.errors.errorPrefix}${env.errors.default.errorCode}`,
      message: env.errors.default.errorMessage,
      description: env.errors.default.errorDescription
    };

    return new Error(httpCode, code, message, description);
  }

  public static createErrorFromStdError(httpCode: number, error: StdError): Error {
    return new Error(httpCode, error.code, error.message, error.description);
  }
}
