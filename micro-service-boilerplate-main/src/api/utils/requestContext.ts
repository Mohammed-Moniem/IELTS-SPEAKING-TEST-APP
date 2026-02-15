import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

import { AUTHORIZATION_HEADER, CONTENT_TYPE_HEADER, URC_HEADER } from '@api/constants/headers';

export const buildRequestHeaders = (req: Request, fallbackPrefix: string): IRequestHeaders => {
  const incoming = (req.header(URC_HEADER) || '').trim();
  const urc = incoming || `${fallbackPrefix}-${randomUUID()}`;

  return {
    urc,
    Authorization: req.header(AUTHORIZATION_HEADER) || undefined,
    'Content-Type': req.header(CONTENT_TYPE_HEADER) || undefined,
    'Unique-Reference-Code': urc
  };
};

export const ensureResponseHeaders = (res: Response, headers: IRequestHeaders) => {
  if (headers['Unique-Reference-Code'] && !res.getHeader(URC_HEADER)) {
    res.setHeader(URC_HEADER, headers['Unique-Reference-Code']);
  }
};
