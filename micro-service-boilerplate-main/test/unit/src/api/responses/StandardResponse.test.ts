import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { StandardResponse } from '@responses/StandardResponse';
import { Response } from 'express';

// Mock Logger
jest.mock('@lib/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

// Mock constructLogMessage
jest.mock('@lib/env/helpers', () => ({
  constructLogMessage: jest.fn().mockReturnValue('mocked-log-message')
}));

describe('StandardResponse', () => {
  let mockResponse: Partial<Response>;
  let mockHeaders: IRequestHeaders;

  beforeEach(() => {
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockHeaders = { urc: 'test-urc-123' };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('success', () => {
    it('should send a successful response with data', () => {
      const testData = { id: '123', name: 'Test User' };
      const testMessage = 'Operation successful';

      StandardResponse.success(mockResponse as Response, testData, testMessage, HTTP_STATUS_CODES.SUCCESS, mockHeaders);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.SUCCESS);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: HTTP_STATUS_CODES.SUCCESS,
          success: true,
          message: testMessage,
          data: testData,
          timestamp: expect.any(String),
          requestId: mockHeaders.urc
        })
      );
    });

    it('should send a successful response without data', () => {
      const testMessage = 'Operation successful';

      StandardResponse.success(
        mockResponse as Response,
        undefined,
        testMessage,
        HTTP_STATUS_CODES.SUCCESS,
        mockHeaders
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.SUCCESS);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: HTTP_STATUS_CODES.SUCCESS,
          success: true,
          message: testMessage,
          timestamp: expect.any(String),
          requestId: mockHeaders.urc
        })
      );

      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseCall).not.toHaveProperty('data');
    });

    it('should send a successful response with default status code', () => {
      const testData = { result: 'test' };

      StandardResponse.success(mockResponse as Response, testData);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.SUCCESS);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: HTTP_STATUS_CODES.SUCCESS,
          success: true,
          data: testData,
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('created', () => {
    it('should send a created response', () => {
      const testData = { id: '123', name: 'New User' };
      const testMessage = 'User created successfully';

      StandardResponse.created(mockResponse as Response, testData, testMessage, mockHeaders);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.CREATED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: HTTP_STATUS_CODES.CREATED,
          success: true,
          message: testMessage,
          data: testData,
          timestamp: expect.any(String),
          requestId: mockHeaders.urc
        })
      );
    });

    it('should send a created response with default message', () => {
      const testData = { id: '123' };

      StandardResponse.created(mockResponse as Response, testData, undefined, mockHeaders);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Resource created successfully'
        })
      );
    });
  });

  describe('error', () => {
    it('should send an error response with CSError', () => {
      const testError = new CSError(
        HTTP_STATUS_CODES.BAD_REQUEST,
        CODES.InvalidBody,
        'Test error message',
        'Test error description'
      );

      StandardResponse.error(mockResponse as Response, testError, mockHeaders);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: HTTP_STATUS_CODES.BAD_REQUEST,
          success: false,
          error: {
            code: CODES.InvalidBody,
            message: 'Test error message',
            description: 'Test error description'
          },
          timestamp: expect.any(String),
          requestId: mockHeaders.urc
        })
      );
    });

    it('should send an error response with standard Error', () => {
      const testError = new Error('Standard error message');

      StandardResponse.error(mockResponse as Response, testError, mockHeaders);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
          success: false,
          error: {
            code: CODES.GenericErrorMessage,
            message: 'Standard error message'
          },
          timestamp: expect.any(String),
          requestId: mockHeaders.urc
        })
      );
    });

    it('should send an error response with string error', () => {
      const testError = 'String error message';

      StandardResponse.error(mockResponse as Response, testError, mockHeaders);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
          success: false,
          error: {
            code: CODES.GenericErrorMessage,
            message: 'String error message'
          },
          timestamp: expect.any(String),
          requestId: mockHeaders.urc
        })
      );
    });

    it('should send an error response with unknown payload', () => {
      StandardResponse.error(mockResponse as Response, { unexpected: true } as unknown as Error, mockHeaders);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: CODES.GenericErrorMessage,
            message: 'An unexpected error occurred'
          })
        })
      );
    });
  });

  describe('validationError', () => {
    it('should send a validation error response', () => {
      const validationErrors = [
        { field: 'email', message: 'Invalid email format' },
        { field: 'name', message: 'Name is required' }
      ];
      const testMessage = 'Validation failed';

      StandardResponse.validationError(mockResponse as Response, validationErrors, testMessage, mockHeaders);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: HTTP_STATUS_CODES.BAD_REQUEST,
          success: false,
          error: {
            code: CODES.InvalidBody,
            message: testMessage,
            details: validationErrors
          },
          timestamp: expect.any(String),
          requestId: mockHeaders.urc
        })
      );
    });

    it('should send a validation error response with default message', () => {
      const validationErrors = [{ field: 'test', message: 'Test error' }];

      StandardResponse.validationError(mockResponse as Response, validationErrors, undefined, mockHeaders);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Validation failed'
          })
        })
      );
    });
  });

  describe('notFound', () => {
    it('should send a not found error response', () => {
      const resource = 'User';

      StandardResponse.notFound(mockResponse as Response, resource, mockHeaders);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: HTTP_STATUS_CODES.NOT_FOUND,
          success: false,
          error: {
            code: CODES.NotFound,
            message: 'User not found'
          },
          timestamp: expect.any(String),
          requestId: mockHeaders.urc
        })
      );
    });

    it('should send a not found error response with default resource', () => {
      StandardResponse.notFound(mockResponse as Response, undefined, mockHeaders);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Resource not found'
          })
        })
      );
    });
  });

  describe('unauthorized', () => {
    it('should send an unauthorized error response', () => {
      const testMessage = 'Authentication required';

      StandardResponse.unauthorized(mockResponse as Response, testMessage, mockHeaders);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: HTTP_STATUS_CODES.UNAUTHORIZED,
          success: false,
          error: {
            code: CODES.NotAuthorized,
            message: testMessage
          },
          timestamp: expect.any(String),
          requestId: mockHeaders.urc
        })
      );
    });

    it('should send an unauthorized error response with default message', () => {
      StandardResponse.unauthorized(mockResponse as Response, undefined, mockHeaders);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Unauthorized access'
          })
        })
      );
    });
  });

  describe('forbidden', () => {
    it('should send a forbidden error response', () => {
      const testMessage = 'Access denied';

      StandardResponse.forbidden(mockResponse as Response, testMessage, mockHeaders);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.FORBIDDEN);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: HTTP_STATUS_CODES.FORBIDDEN,
          success: false,
          error: {
            code: CODES.Forbidden,
            message: testMessage
          },
          timestamp: expect.any(String),
          requestId: mockHeaders.urc
        })
      );
    });
  });

  describe('internalError', () => {
    it('should send an internal server error response with Error object', () => {
      const testError = new Error('Internal error');

      StandardResponse.internalError(mockResponse as Response, testError, mockHeaders);

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
          success: false,
          error: {
            code: CODES.GenericErrorMessage,
            message: 'Internal error'
          },
          timestamp: expect.any(String),
          requestId: mockHeaders.urc
        })
      );
    });

    it('should send an internal server error response with string', () => {
      const testError = 'Something went wrong';

      StandardResponse.internalError(mockResponse as Response, testError, mockHeaders);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: testError
          })
        })
      );
    });

    it('should send an internal server error response with default message', () => {
      StandardResponse.internalError(mockResponse as Response, undefined, mockHeaders);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Internal server error'
          })
        })
      );
    });
  });
});
