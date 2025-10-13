import * as express from 'express';
import { Container } from 'typedi';

import { Error } from '../../../../../src/api/errors/Error';
import { CODES, HTTP_STATUS_CODES } from '../../../../../src/api/errors/errorCodeConstants';
import { HeaderMiddleware } from '../../../../../src/api/middlewares/HeaderMiddleware';

jest.mock('typedi', () => ({
  Container: {
    set: jest.fn()
  },
  Service: jest.fn(() => (target: any) => target)
}));

describe('HeaderMiddleware', () => {
  let middleware: HeaderMiddleware;
  let mockRequest: Partial<express.Request>;
  let mockResponse: Partial<express.Response>;
  let nextFunction: express.NextFunction;

  beforeEach(() => {
    middleware = new HeaderMiddleware();
    mockResponse = {
      setHeader: jest.fn().mockReturnThis()
    };
    nextFunction = jest.fn();
  });

  it('should throw error if Authorization header is empty', () => {
    mockRequest = {
      header: jest.fn().mockReturnValue('')
    };
    expect(() =>
      middleware.use(mockRequest as express.Request, mockResponse as express.Response, nextFunction)
    ).toThrowError(new Error(HTTP_STATUS_CODES.BAD_REQUEST, CODES.EmptyAuthorization));
  });

  it('should throw error if Authorization header does not contain Bearer', () => {
    mockRequest = {
      header: jest.fn().mockReturnValue('Token')
    };
    expect(() =>
      middleware.use(mockRequest as express.Request, mockResponse as express.Response, nextFunction)
    ).toThrowError(new Error(HTTP_STATUS_CODES.BAD_REQUEST, CODES.NotAuthorized));
  });

  it('should throw error if Unique-Reference-Code header is empty', () => {
    mockRequest = {
      header: jest.fn().mockReturnValueOnce('Bearer token').mockReturnValueOnce('')
    };
    expect(() =>
      middleware.use(mockRequest as express.Request, mockResponse as express.Response, nextFunction)
    ).toThrowError(new Error(HTTP_STATUS_CODES.BAD_REQUEST, CODES.EmptyURC));
  });

  it('should set requestHeaders in Container and call next function', () => {
    const urc = '123';
    mockRequest = {
      header: jest.fn().mockReturnValueOnce('Bearer token').mockReturnValueOnce(urc),
      headers: { Authorization: 'Bearer token', 'Unique-Reference-Code': urc }
    };
    middleware.use(mockRequest as express.Request, mockResponse as express.Response, nextFunction);

    expect(Container.set).toHaveBeenCalledWith('requestHeaders', mockRequest.headers);
    expect(nextFunction).toHaveBeenCalled();
  });
});
