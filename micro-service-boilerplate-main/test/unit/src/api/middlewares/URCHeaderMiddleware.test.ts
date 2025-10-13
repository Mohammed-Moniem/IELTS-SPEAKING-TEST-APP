import * as express from 'express';
import 'reflect-metadata';
import { Container } from 'typedi';
import { CODES, HTTP_STATUS_CODES } from '../../../../../src/api/errors/errorCodeConstants';
import { URCHeaderMiddleware } from '../../../../../src/api/middlewares/URCHeaderMiddleware';

describe('URCHeaderMiddleware', () => {
  let middleware: URCHeaderMiddleware;
  let mockRequest: Partial<express.Request>;
  let mockResponse: Partial<express.Response>;
  let mockNext: jest.Mock;
  let mockSetHeader: jest.Mock;

  beforeEach(() => {
    middleware = new URCHeaderMiddleware();
    mockSetHeader = jest.fn();
    mockRequest = {
      header: jest.fn(),
      headers: {}
    };
    mockResponse = {
      setHeader: mockSetHeader
    };
    mockNext = jest.fn();

    // Clear the container
    Container.reset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Container.reset();
  });

  describe('when URC header is present', () => {
    it('should call next() when valid URC header is provided', () => {
      const urc = 'test-urc-123';
      (mockRequest.header as jest.Mock).mockReturnValue(urc);

      middleware.use(mockRequest as express.Request, mockResponse as express.Response, mockNext);

      expect(mockSetHeader).toHaveBeenCalledWith('Unique-Reference-Code', urc);
      expect(Container.get('requestHeaders')).toBe(mockRequest.headers);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle URC header with whitespace correctly', () => {
      const urc = '  test-urc-456  ';
      const trimmedUrc = 'test-urc-456';
      (mockRequest.header as jest.Mock).mockReturnValue(urc);

      middleware.use(mockRequest as express.Request, mockResponse as express.Response, mockNext);

      expect(mockSetHeader).toHaveBeenCalledWith('Unique-Reference-Code', trimmedUrc);
      expect(Container.get('requestHeaders')).toBe(mockRequest.headers);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should set request headers in container', () => {
      const urc = 'test-urc-789';
      const headers = { 'content-type': 'application/json', authorization: 'Bearer token' };
      (mockRequest.header as jest.Mock).mockReturnValue(urc);
      mockRequest.headers = headers;

      middleware.use(mockRequest as express.Request, mockResponse as express.Response, mockNext);

      expect(Container.get('requestHeaders')).toBe(headers);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle complex URC values', () => {
      const urc = 'complex-urc-with-dashes-and-numbers-123-456';
      (mockRequest.header as jest.Mock).mockReturnValue(urc);

      middleware.use(mockRequest as express.Request, mockResponse as express.Response, mockNext);

      expect(mockSetHeader).toHaveBeenCalledWith('Unique-Reference-Code', urc);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle UUID format URC', () => {
      const urc = '550e8400-e29b-41d4-a716-446655440000';
      (mockRequest.header as jest.Mock).mockReturnValue(urc);

      middleware.use(mockRequest as express.Request, mockResponse as express.Response, mockNext);

      expect(mockSetHeader).toHaveBeenCalledWith('Unique-Reference-Code', urc);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('when URC header is missing or invalid', () => {
    it('should throw error when URC header is missing', () => {
      (mockRequest.header as jest.Mock).mockReturnValue(undefined);

      expect(() => {
        middleware.use(mockRequest as express.Request, mockResponse as express.Response, mockNext);
      }).toThrow();

      expect(mockSetHeader).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw error when URC header is empty string', () => {
      (mockRequest.header as jest.Mock).mockReturnValue('');

      expect(() => {
        middleware.use(mockRequest as express.Request, mockResponse as express.Response, mockNext);
      }).toThrow();

      expect(mockSetHeader).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw error when URC header is only whitespace', () => {
      (mockRequest.header as jest.Mock).mockReturnValue('   ');

      expect(() => {
        middleware.use(mockRequest as express.Request, mockResponse as express.Response, mockNext);
      }).toThrow();

      expect(mockSetHeader).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw error when URC header is null', () => {
      (mockRequest.header as jest.Mock).mockReturnValue(null);

      expect(() => {
        middleware.use(mockRequest as express.Request, mockResponse as express.Response, mockNext);
      }).toThrow();

      expect(mockSetHeader).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw error with correct error properties', () => {
      (mockRequest.header as jest.Mock).mockReturnValue('');

      let thrownError: any;
      try {
        middleware.use(mockRequest as express.Request, mockResponse as express.Response, mockNext);
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError.httpCode).toBe(HTTP_STATUS_CODES.BAD_REQUEST);
      expect(thrownError.code).toBe(CODES.EmptyURC);
    });
  });

  describe('container functionality', () => {
    it('should set request headers in typedi container', () => {
      const urc = 'test-urc';
      const headers = {
        'content-type': 'application/json',
        authorization: 'Bearer test-token',
        'user-agent': 'test-agent'
      };
      (mockRequest.header as jest.Mock).mockReturnValue(urc);
      mockRequest.headers = headers;

      middleware.use(mockRequest as express.Request, mockResponse as express.Response, mockNext);

      const containerHeaders = Container.get('requestHeaders');
      expect(containerHeaders).toBe(headers);
      expect(containerHeaders).toEqual(headers);
    });

    it('should overwrite previous container values', () => {
      // Set initial value
      Container.set('requestHeaders', { old: 'headers' });

      const urc = 'test-urc';
      const newHeaders = { new: 'headers' };
      (mockRequest.header as jest.Mock).mockReturnValue(urc);
      mockRequest.headers = newHeaders;

      middleware.use(mockRequest as express.Request, mockResponse as express.Response, mockNext);

      const containerHeaders = Container.get('requestHeaders');
      expect(containerHeaders).toBe(newHeaders);
      expect(containerHeaders).not.toEqual({ old: 'headers' });
    });
  });
});
