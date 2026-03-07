import { CODES, HTTP_STATUS_CODES } from '../../../../../src/api/errors/errorCodeConstants';

describe('errorCodeConstants', () => {
  it('should have correct HTTP_STATUS_CODES', () => {
    const expectedHTTP_STATUS_CODES = {
      SUCCESS: 200,
      CREATED: 201,
      BAD_REQUEST: 400,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
      TOO_MANY_REQUEST: 429,
      TOO_MANY_REQUESTS: 429,
      PAYMENT_REQUIRED: 402,
      INTERNAL_SERVER_ERROR: 500,
      BAD_GATEWAY: 502,
      SERVICE_UNAVAILABLE: 503
    };
    expect(HTTP_STATUS_CODES).toEqual(expectedHTTP_STATUS_CODES);
  });

  it('should have correct CODES', () => {
    const expectedCodes = {
      EmptyAuthorization: 'EmptyAuthorization',
      EmptyContentType: 'EmptyContentType',
      EmptyURC: 'EmptyURC',
      Forbidden: 'Forbidden',
      GenericErrorMessage: 'GenericErrorMessage',
      InvalidBody: 'InvalidBody',
      InvalidContentType: 'InvalidContentType',
      InvalidCredentials: 'InvalidCredentials',
      InvalidField: 'InvalidField',
      InvalidGeospatialQuery: 'InvalidGeospatialQuery',
      InvalidQuery: 'InvalidQuery',
      InvalidQueryParam: 'InvalidQueryParam',
      InvalidToken: 'InvalidToken',
      InvalidURC: 'InvalidURC',
      InvalidUserId: 'InvalidUserId',
      MissingUserId: 'MissingUserId',
      NotAuthorized: 'NotAuthorized',
      NotFound: 'NotFound',
      NotImplemented: 'NotImplemented',
      OpenAIError: 'OpenAIError',
      OpenAIInvalidRequest: 'OpenAIInvalidRequest',
      OpenAIQuotaExceeded: 'OpenAIQuotaExceeded',
      OpenAIRateLimit: 'OpenAIRateLimit',
      PremiumRequired: 'PremiumRequired',
      RefreshTokenRevoked: 'RefreshTokenRevoked',
      StripeError: 'StripeError',
      TokenExpired: 'TokenExpired',
      UsageLimitReached: 'UsageLimitReached',
      UserAlreadyExists: 'UserAlreadyExists'
    };
    expect(CODES).toEqual(expectedCodes);
  });
});
