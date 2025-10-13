import * as express from 'express';
import { StatusCodes } from 'http-status-codes';
import { HttpError } from 'routing-controllers';

import { ErrorResponse } from '../../../../../src/api/errors/ErrorResponse';
import { ErrorHandlerMiddleware } from '../../../../../src/api/middlewares/ErrorHandleMiddleware';

jest.mock('../../../../../src/lib/logger');

describe('ErrorHandlerMiddleware', () => {
  let middleware: ErrorHandlerMiddleware;
  let mockRequest: Partial<express.Request>;
  let mockResponse: Partial<express.Response>;
  let nextFunction: express.NextFunction;

  beforeEach(() => {
    middleware = new ErrorHandlerMiddleware();
    mockRequest = {
      headers: { 'Unique-Reference-Code': '123' },
      method: 'GET',
      url: '/test'
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    nextFunction = jest.fn();
  });

  it('should handle error', () => {
    const httpError = new HttpError(StatusCodes.BAD_REQUEST, 'Test error');
    middleware.error(httpError, mockRequest as express.Request, mockResponse as express.Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({ errors: new ErrorResponse(httpError).get() });
    expect(nextFunction).toHaveBeenCalled();
  });
});
