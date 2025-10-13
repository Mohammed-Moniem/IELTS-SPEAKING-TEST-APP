import { ErrorHandlerMiddleware } from '@middlewares/ErrorHandleMiddleware';
import { Request, Response } from 'express';

const infoMock = jest.fn();

jest.mock('@lib/logger', () => ({
  Logger: class {
    public info = infoMock;
  }
}));

jest.mock('@env', () => ({
  env: {
    isProduction: false,
    errors: {
      errorPrefix: 'SERVICE',
      default: {
        errorCode: 'DEFAULT',
        errorMessage: 'Default message',
        errorDescription: 'Default description'
      }
    }
  }
}));

describe('ErrorHandlerMiddleware', () => {
  it('formats errors via ErrorResponse and calls next', () => {
    infoMock.mockClear();
    const middleware = new ErrorHandlerMiddleware();
    const error = { httpCode: 422, message: 'Invalid data' } as any;
    const req = {
      headers: {
        'Unique-Reference-Code': 'test-urc'
      },
      method: 'POST',
      url: '/test'
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    } as any as Response;
    const next = jest.fn();

    middleware.error(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      errors: expect.any(Array)
    });
    expect(next).toHaveBeenCalled();
  });
});
