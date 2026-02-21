import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { Response } from 'express';

/**
 * Standard API Response Structure
 */
export interface IStandardResponse<T = any> {
  status: number;
  success: boolean;
  message?: string | string[];
  data?: T;
  timestamp: string;
  requestId?: string;
}

/**
 * Standard API Error Response Structure
 */
export interface IStandardErrorResponse {
  status: number;
  success: false;
  error: {
    code: string;
    message: string;
    description?: string;
    details?: any;
  };
  timestamp: string;
  requestId?: string;
}

/**
 * Standard Response Handler Class
 *
 * Provides consistent response formatting for all API endpoints.
 * Integrates with existing CSError and ErrorResponse classes.
 */
export class StandardResponse {
  private static log = new Logger(__filename);

  /**
   * Send a successful response
   *
   * @param res - Express response object
   * @param data - Response data
   * @param message - Success message(s)
   * @param status - HTTP status code (default: 200)
   * @param headers - Request headers for logging context
   */
  public static success<T = any>(
    res: Response,
    data?: T,
    message?: string | string[],
    status: number = HTTP_STATUS_CODES.SUCCESS,
    headers?: IRequestHeaders
  ): Response {
    const logMessage = constructLogMessage(__filename, 'success', headers || ({} as IRequestHeaders));
    this.log.info(`${logMessage} - Sending success response with status: ${status}`);

    const response: IStandardResponse<T> = {
      status,
      success: true,
      timestamp: new Date().toISOString(),
      requestId: headers?.urc
    };

    if (message) {
      response.message = message;
    }

    if (data !== undefined) {
      response.data = data;
    }

    return res.status(status).json(response);
  }

  /**
   * Send a created response (HTTP 201)
   *
   * @param res - Express response object
   * @param data - Created resource data
   * @param message - Success message
   * @param headers - Request headers for logging context
   */
  public static created<T = any>(
    res: Response,
    data?: T,
    message: string = 'Resource created successfully',
    headers?: IRequestHeaders
  ): Response {
    return this.success(res, data, message, HTTP_STATUS_CODES.CREATED, headers);
  }

  /**
   * Send an error response using CSError
   *
   * @param res - Express response object
   * @param error - CSError instance or error details
   * @param headers - Request headers for logging context
   */
  public static error(res: Response, error: CSError | Error | string, headers?: IRequestHeaders): Response {
    const logMessage = constructLogMessage(__filename, 'error', headers || ({} as IRequestHeaders));
    this.log.error(`${logMessage} - Sending error response`, error);

    let csError: CSError;

    // Convert different error types to CSError
    // Use duck typing to check for CSError-like objects (more robust than instanceof)
    if (error && typeof error === 'object' && 'httpCode' in error && 'code' in error) {
      csError = error as CSError;
    } else if (error instanceof Error) {
      csError = new CSError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, CODES.GenericErrorMessage, error.message);
    } else if (typeof error === 'string') {
      csError = new CSError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, CODES.GenericErrorMessage, error);
    } else {
      csError = new CSError(
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        CODES.GenericErrorMessage,
        'An unexpected error occurred'
      );
    }

    const errorResponse: IStandardErrorResponse = {
      status: csError.httpCode,
      success: false,
      error: {
        code: csError.code,
        message: csError.message || 'An error occurred',
        description: csError.description
      },
      timestamp: new Date().toISOString(),
      requestId: headers?.urc
    };

    return res.status(csError.httpCode).json(errorResponse);
  }

  /**
   * Send a validation error response
   *
   * @param res - Express response object
   * @param errors - Validation error details
   * @param message - Error message
   * @param headers - Request headers for logging context
   */
  public static validationError(
    res: Response,
    errors: any[],
    message: string = 'Validation failed',
    headers?: IRequestHeaders
  ): Response {
    const logMessage = constructLogMessage(__filename, 'validationError', headers || ({} as IRequestHeaders));
    this.log.warn(`${logMessage} - Validation error: ${message}`);

    const errorResponse: IStandardErrorResponse = {
      status: HTTP_STATUS_CODES.BAD_REQUEST,
      success: false,
      error: {
        code: CODES.InvalidBody,
        message,
        details: errors
      },
      timestamp: new Date().toISOString(),
      requestId: headers?.urc
    };

    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
  }

  /**
   * Send a not found error response
   *
   * @param res - Express response object
   * @param resource - Name of the resource that was not found
   * @param headers - Request headers for logging context
   */
  public static notFound(res: Response, resource: string = 'Resource', headers?: IRequestHeaders): Response {
    const message = `${resource} not found`;
    const csError = new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, message);
    return this.error(res, csError, headers);
  }

  /**
   * Send an unauthorized error response
   *
   * @param res - Express response object
   * @param message - Error message
   * @param headers - Request headers for logging context
   */
  public static unauthorized(
    res: Response,
    message: string = 'Unauthorized access',
    headers?: IRequestHeaders
  ): Response {
    const csError = new CSError(HTTP_STATUS_CODES.UNAUTHORIZED, CODES.NotAuthorized, message);
    return this.error(res, csError, headers);
  }

  /**
   * Send a forbidden error response
   *
   * @param res - Express response object
   * @param message - Error message
   * @param headers - Request headers for logging context
   */
  public static forbidden(res: Response, message: string = 'Access forbidden', headers?: IRequestHeaders): Response {
    const csError = new CSError(HTTP_STATUS_CODES.FORBIDDEN, CODES.Forbidden, message);
    return this.error(res, csError, headers);
  }

  /**
   * Send an internal server error response
   *
   * @param res - Express response object
   * @param error - Error details
   * @param headers - Request headers for logging context
   */
  public static internalError(res: Response, error?: Error | string, headers?: IRequestHeaders): void {
    const message = error instanceof Error ? error.message : error || 'Internal server error';
    const csError = new CSError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, CODES.GenericErrorMessage, message);
    this.error(res, csError, headers);
  }
}
