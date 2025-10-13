import { CSError } from '../../../../../src/api/errors/CSError';
import { env } from '../../../../../src/env';

describe('CSError Class', () => {
  it('should create a new CSError', () => {
    const error = new CSError(400, 'TEST_CODE', 'Test message', 'Test description');
    expect(error.httpCode).toBe(400);
    expect(error.code).toBe('TEST_CODE');
    expect(error.message).toBe('Test message');
    expect(error.description).toBe('Test description');
  });

  it('should create a new CSError using createError method', () => {
    const error = CSError.createError(400, 'TEST_CODE');
    expect(error.httpCode).toBe(400);
    expect(error.code).toBe(`${env.errors.errorPrefix}${env.errors.default.errorCode}`);
    expect(error.message).toBe(env.errors.default.errorMessage);
    expect(error.description).toBe(env.errors.default.errorDescription);
  });
});
