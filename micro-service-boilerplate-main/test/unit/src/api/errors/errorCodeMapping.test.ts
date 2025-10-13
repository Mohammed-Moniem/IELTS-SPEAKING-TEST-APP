import { CODES } from '../../../../../src/api/errors/errorCodeConstants';
import { constantErrors } from '../../../../../src/api/errors/errorCodeMapping';

describe('errorCodeMapping', () => {
  it('should have correct constantErrors', () => {
    const expectedErrors = {
      [CODES.InvalidBody]: {
        code: 'GLOBAL.BODY_INVALID',
        message: 'Invalid Request Parameters',
        description: 'Invalid Request Parameters'
      },
      [CODES.EmptyContentType]: {
        code: 'GLOBAL.EMPTY_CONTENT_TYPE',
        message: 'Content-Type header is required',
        description: 'Content-Type header is missing or empty'
      },
      [CODES.InvalidContentType]: {
        code: 'GLOBAL.INVALID_CONTENT_TYPE',
        message: 'Invalid Content-Type',
        description: 'Content-Type header value is not supported'
      },
      [CODES.EmptyAuthorization]: {
        code: 'GLOBAL.EMPTY_AUTHORIZATION',
        message: 'Authorization header is required',
        description: 'Authorization header is missing or empty'
      },
      [CODES.NotAuthorized]: {
        code: 'GLOBAL.NOT_AUTHORIZED',
        message: 'Not Authorized',
        description: 'Invalid or missing authorization credentials'
      },
      [CODES.EmptyURC]: {
        code: 'GLOBAL.EMPTY_URC',
        message: 'Unique-Reference-Code header is required',
        description: 'Unique-Reference-Code header is missing or empty'
      },
      [CODES.InvalidURC]: {
        code: 'GLOBAL.INVALID_URC',
        message: 'Invalid Unique-Reference-Code',
        description: 'Unique-Reference-Code header value is invalid'
      },
      [CODES.InvalidQueryParam]: {
        code: 'GLOBAL.INVALID_QUERY_PARAM',
        message: 'Invalid query parameter',
        description: 'One or more query parameters are invalid'
      },
      [CODES.MissingUserId]: {
        code: 'GLOBAL.MISSING_USER_ID',
        message: 'User ID is required',
        description: 'User ID parameter is missing'
      },
      [CODES.InvalidUserId]: {
        code: 'GLOBAL.INVALID_USER_ID',
        message: 'Invalid User ID',
        description: 'User ID parameter is invalid'
      },
      [CODES.GenericErrorMessage]: {
        code: 'GLOBAL.INTERVAL_SERVER_ERROR',
        message: 'There is some issue. Please contact administrator',
        description: 'There is some issue. Please contact administrator'
      },
      [CODES.NotFound]: {
        code: 'GLOBAL.NOT_FOUND',
        message: 'Not Found',
        description: 'Not Found'
      },
      [CODES.OpenAIError]: {
        code: 'OPENAI.GENERAL_ERROR',
        message: 'OpenAI service error',
        description: 'An error occurred while communicating with OpenAI service'
      },
      [CODES.OpenAIQuotaExceeded]: {
        code: 'OPENAI.QUOTA_EXCEEDED',
        message: 'OpenAI quota exceeded',
        description: 'OpenAI API quota has been exceeded. Please check your usage limits.'
      },
      [CODES.OpenAIInvalidRequest]: {
        code: 'OPENAI.INVALID_REQUEST',
        message: 'Invalid OpenAI request',
        description: 'The request to OpenAI service is invalid'
      },
      [CODES.OpenAIRateLimit]: {
        code: 'OPENAI.RATE_LIMIT',
        message: 'OpenAI rate limit exceeded',
        description: 'Too many requests to OpenAI service. Please try again later.'
      }
    };
    expect(constantErrors).toEqual(expectedErrors);
  });
});
