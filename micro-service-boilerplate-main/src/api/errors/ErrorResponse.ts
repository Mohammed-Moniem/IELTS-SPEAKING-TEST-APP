import { env } from '@env';
import { isArray } from 'class-validator';
import { StdError, toStandardErrorCode, toStandardErrorFormat } from './errorCodes';

export class ErrorResponse {
  public type = 'error-response';
  private errorList: Array<StdError> = [];

  constructor(error?: any) {
    if (error) {
      this.push(error);
    }
  }

  public push(error: any): ErrorResponse {
    error = typeof error.message == 'object' ? error.message : error;
    if (error.type === 'error-response') {
      this.errorList.push(...(error as ErrorResponse).get());
      return this;
    }

    if (isArray(error.errors)) {
      for (const err of error.errors) {
        if (this.isStandardError(err)) {
          this.pushErrorObject(err);
        } else {
          this.pushConstraints(err);
        }
      }
      return this;
    }

    if (typeof error === 'object') {
      this.pushErrorObject(error);
      return this;
    }

    if (typeof error === 'string') {
      this.errorList.push(toStandardErrorFormat(error));
      return this;
    }

    return this;
  }

  public get(): Array<StdError> {
    return this.errorList;
  }

  private isStandardError(error: { [key: string]: string }): boolean {
    const validKeys = ['code', 'message', 'description'];
    const availableKeys = new Set(Object.keys(error));

    return validKeys.reduce((isValid: boolean, key: string) => {
      return !availableKeys.has(key) ? false : isValid;
    }, true);
  }

  private pushConstraints(error: { [key: string]: any }): void {
    const parseConstraints = (err: { [key: string]: any }) => {
      if (err) {
        for (const item of Object.keys(err.constraints || {})) {
          this.errorList.push(toStandardErrorFormat(err.constraints[item]));
        }
        for (const child of err.children || []) {
          parseConstraints(child);
        }
      }
    };
    parseConstraints(error);
  }

  private pushErrorObject(error: { [key: string]: string }): void {
    if (!error) {
      return;
    }

    if (this.isStandardError(error)) {
      this.errorList.push({
        code: toStandardErrorCode(error.code),
        message: error.message,
        description: error.description
      });
      return;
    }
    this.errorList.push(
      Object.assign(
        {},
        {
          code: toStandardErrorCode(error.code),
          message: error.message || env.errors.default.errorMessage,
          desscription: error.description || env.errors.default.errorDescription
        },
        toStandardErrorFormat(error.code)
      )
    );
  }
}
