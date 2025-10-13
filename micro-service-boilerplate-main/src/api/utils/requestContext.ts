import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

export const buildRequestHeaders = (req: Request, fallbackPrefix: string): IRequestHeaders => {
  const incoming = (req.header('Unique-Reference-Code') || '').trim();
  const urc = incoming || `${fallbackPrefix}-${randomUUID()}`;

  return {
    urc,
    Authorization: req.header('Authorization') || undefined,
    'Content-Type': req.header('Content-Type') || undefined,
    'Unique-Reference-Code': urc
  };
};

export const ensureResponseHeaders = (res: Response, headers: IRequestHeaders) => {
  if (headers['Unique-Reference-Code'] && !res.getHeader('Unique-Reference-Code')) {
    res.setHeader('Unique-Reference-Code', headers['Unique-Reference-Code']);
  }
};
