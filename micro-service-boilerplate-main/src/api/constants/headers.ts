export const AUTHORIZATION_HEADER = 'Authorization' as const;
export const CONTENT_TYPE_HEADER = 'Content-Type' as const;
export const URC_HEADER = 'Unique-Reference-Code' as const;

// Express lowercases incoming header keys on `req.headers`
export const URC_HEADER_LOWERCASE = 'unique-reference-code' as const;
