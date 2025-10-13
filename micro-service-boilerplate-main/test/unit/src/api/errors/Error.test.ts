import { Error } from '../../../../../src/api/errors/Error';
import { StdError, errors } from '../../../../../src/api/errors/errorCodes';
import { env } from '../../../../../src/env';

describe('Error', () => {
  it('should correctly initialize with constructor', () => {
    const error = new Error(404, 'NOT_FOUND', 'Not found', 'The requested resource was not found');
    expect(error.httpCode).toEqual(404);
    expect(error.code).toEqual('NOT_FOUND');
    expect(error.message).toEqual('Not found');
    expect(error.description).toEqual('The requested resource was not found');
  });

  it('should create error with given errorCode', () => {
    const errorCode = Object.keys(errors)[0]; // Use the first error code for testing
    const error = Error.createError(500, errorCode);
    expect(error.httpCode).toEqual(500);
    expect(error.code).toEqual(errors[errorCode].code);
    expect(error.message).toEqual(errors[errorCode].message);
    expect(error.description).toEqual(errors[errorCode].description);
  });

  it('should create error with default values if errorCode is not found', () => {
    const error = Error.createError(500, 'UNKNOWN_ERROR_CODE');
    expect(error.httpCode).toEqual(500);
    expect(error.code).toEqual(`${env.errors.errorPrefix}${env.errors.default.errorCode}`);
    expect(error.message).toEqual(env.errors.default.errorMessage);
    expect(error.description).toEqual(env.errors.default.errorDescription);
  });

  it('should create error from StdError', () => {
    const stdError: StdError = {
      code: 'STD_ERROR',
      message: 'Standard error',
      description: 'This is a standard error'
    };
    const error = Error.createErrorFromStdError(400, stdError);
    expect(error.httpCode).toEqual(400);
    expect(error.code).toEqual(stdError.code);
    expect(error.message).toEqual(stdError.message);
    expect(error.description).toEqual(stdError.description);
  });
});
