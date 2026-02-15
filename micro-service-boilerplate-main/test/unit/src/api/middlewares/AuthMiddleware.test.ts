import * as express from 'express';
import 'reflect-metadata';

import { AuthMiddleware } from '../../../../../src/api/middlewares/AuthMiddleware';

const verifyAccessTokenMock = jest.fn();
const randomUUIDMock = jest.fn();

jest.mock('@lib/logger', () => ({
  Logger: class {
    public debug = jest.fn();
    public info = jest.fn();
    public warn = jest.fn();
    public error = jest.fn();
  }
}));

jest.mock('@lib/env/helpers', () => ({
  constructLogMessage: jest.fn().mockReturnValue('mock-log-message')
}));

jest.mock('@lib/auth/token', () => ({
  verifyAccessToken: (...args: unknown[]) => verifyAccessTokenMock(...args)
}));

jest.mock('crypto', () => ({
  randomUUID: () => randomUUIDMock()
}));

describe('AuthMiddleware', () => {
  let middleware: AuthMiddleware;
  let mockRequest: Partial<express.Request>;
  let mockResponse: Partial<express.Response>;
  let nextFunction: express.NextFunction;
  let mockSetHeader: jest.Mock;

  beforeEach(() => {
    middleware = new AuthMiddleware();

    verifyAccessTokenMock.mockReset();
    randomUUIDMock.mockReset();

    mockSetHeader = jest.fn();
    mockResponse = {
      setHeader: mockSetHeader
    };

    nextFunction = jest.fn();
  });

  it('echoes an existing Unique-Reference-Code header back in the response', () => {
    const existingUrc = 'client-urc-123';

    verifyAccessTokenMock.mockReturnValue({
      sub: 'user-id-1',
      email: 'user@example.com',
      plan: 'free'
    });

    mockRequest = {
      path: '/users',
      header: jest.fn((name: string) => {
        if (name === 'Authorization') {
          return 'Bearer token';
        }
        if (name === 'Unique-Reference-Code') {
          return existingUrc;
        }
        return undefined;
      })
    };

    middleware.use(mockRequest as express.Request, mockResponse as express.Response, nextFunction);

    expect(randomUUIDMock).not.toHaveBeenCalled();
    expect(mockSetHeader).toHaveBeenCalledWith('Unique-Reference-Code', existingUrc);
    expect(nextFunction).toHaveBeenCalled();
  });

  it('generates a Unique-Reference-Code when missing and does not use the user id', () => {
    const generatedUrc = 'generated-urc-456';

    verifyAccessTokenMock.mockReturnValue({
      sub: 'user-id-2',
      email: 'user2@example.com',
      plan: 'free'
    });
    randomUUIDMock.mockReturnValue(generatedUrc);

    mockRequest = {
      path: '/users',
      header: jest.fn((name: string) => {
        if (name === 'Authorization') {
          return 'Bearer token';
        }
        if (name === 'Unique-Reference-Code') {
          return '';
        }
        return undefined;
      })
    };

    middleware.use(mockRequest as express.Request, mockResponse as express.Response, nextFunction);

    expect(randomUUIDMock).toHaveBeenCalledTimes(1);
    expect(mockSetHeader).toHaveBeenCalledWith('Unique-Reference-Code', generatedUrc);
    expect(mockSetHeader).not.toHaveBeenCalledWith('Unique-Reference-Code', 'user-id-2');
    expect(nextFunction).toHaveBeenCalled();
  });
});
