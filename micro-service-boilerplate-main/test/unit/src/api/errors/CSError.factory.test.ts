import { CSError } from '@errors/CSError';

jest.mock('@env', () => ({
  env: {
    errors: {
      errorPrefix: 'SERVICE',
      default: {
        errorCode: 'DEFAULT.ERROR',
        errorMessage: 'Default message',
        errorDescription: 'Default description'
      }
    }
  }
}));

jest.mock('@errors/errorCodes', () => ({
  errors: {
    KNOWN: {
      code: 'KNOWN.CODE',
      message: 'Known message',
      description: 'Known description'
    }
  }
}));

describe('CSError factory helpers', () => {
  it('createError returns mapped error', () => {
    const err = CSError.createError(400, 'KNOWN');

    expect(err.code).toBe('KNOWN.CODE');
    expect(err.message).toBe('Known message');
    expect(err.description).toBe('Known description');
  });

  it('createError falls back to defaults when unmapped', () => {
    const err = CSError.createError(500, 'UNKNOWN');

    expect(err.code).toContain('SERVICE');
    expect(err.message).toBe('Default message');
    expect(err.description).toBe('Default description');
  });

  it('createErrorFromStdError forwards properties', () => {
    const err = CSError.createErrorFromStdError(418, {
      code: 'SERVICE.CUSTOM',
      message: 'Custom message',
      description: 'Custom description'
    });

    expect(err.httpCode).toBe(418);
    expect(err.code).toBe('SERVICE.CUSTOM');
    expect(err.message).toBe('Custom message');
    expect(err.description).toBe('Custom description');
  });
});
