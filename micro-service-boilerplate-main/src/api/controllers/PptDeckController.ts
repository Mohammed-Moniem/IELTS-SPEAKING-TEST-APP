import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { StandardResponse } from '@responses/StandardResponse';
import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { Logger } from '@lib/logger';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Param, Post, Req, Res } from 'routing-controllers';

import { PptDeckService } from '@services/PptDeckService';

const SESSION_KEY_HEADER = 'x-session-key';

@JsonController('/ppt')
export class PptDeckController {
  private log = new Logger(__filename);

  constructor(private readonly pptDeckService: PptDeckService) {}

  @Get('/deck')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getLatestDeck(@Req() req: Request, @Res() res: Response) {
    const { sessionKey, headers } = this.getOrCreateSessionKey(req, res, 'ppt-get-latest');

    try {
      const latest = await this.pptDeckService.getLatest(sessionKey, headers);
      return StandardResponse.success(
        res,
        { sessionKey, version: latest.version, deck: latest.deck, changeSummary: latest.changeSummary },
        'Deck fetched successfully',
        HTTP_STATUS_CODES.SUCCESS,
        headers
      );
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/deck/versions')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async listVersions(@Req() req: Request, @Res() res: Response) {
    const { sessionKey, headers } = this.getOrCreateSessionKey(req, res, 'ppt-list-versions');

    try {
      const versions = await this.pptDeckService.listVersions(sessionKey, headers);
      return StandardResponse.success(
        res,
        { sessionKey, versions },
        'Deck versions fetched successfully',
        HTTP_STATUS_CODES.SUCCESS,
        headers
      );
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/deck/versions/:version')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getVersion(@Param('version') versionParam: string, @Req() req: Request, @Res() res: Response) {
    const { sessionKey, headers } = this.getOrCreateSessionKey(req, res, 'ppt-get-version');

    const version = Number(versionParam);
    if (!Number.isFinite(version) || version < 1) {
      return StandardResponse.validationError(res, [{ field: 'version', message: 'Version must be a positive integer' }], undefined, headers);
    }

    try {
      const doc = await this.pptDeckService.getVersion(sessionKey, version, headers);
      return StandardResponse.success(
        res,
        { sessionKey, version: doc.version, deck: doc.deck, changeSummary: doc.changeSummary },
        'Deck version fetched successfully',
        HTTP_STATUS_CODES.SUCCESS,
        headers
      );
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/deck')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async createInitialDeck(@Body() body: unknown, @Req() req: Request, @Res() res: Response) {
    const { sessionKey, headers } = this.getOrCreateSessionKey(req, res, 'ppt-create-initial');

    if (!body || typeof body !== 'object' || !('deck' in body)) {
      return StandardResponse.validationError(res, [{ field: 'deck', message: 'deck is required' }], undefined, headers);
    }

    const payload = body as { deck: unknown; changeSummary?: string };

    try {
      const created = await this.pptDeckService.createInitialDeck(sessionKey, payload.deck, payload.changeSummary, headers);
      return StandardResponse.created(
        res,
        { sessionKey, version: created.version, deck: created.deck, changeSummary: created.changeSummary },
        'Deck created successfully',
        headers
      );
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/deck/revise')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async reviseDeck(@Body() body: unknown, @Req() req: Request, @Res() res: Response) {
    const { sessionKey, headers } = this.getOrCreateSessionKey(req, res, 'ppt-revise');

    if (!body || typeof body !== 'object' || !('deck' in body)) {
      return StandardResponse.validationError(res, [{ field: 'deck', message: 'deck is required' }], undefined, headers);
    }

    const payload = body as { deck: unknown; changeSummary?: string };

    try {
      const created = await this.pptDeckService.reviseDeck(sessionKey, payload.deck, payload.changeSummary, headers);
      return StandardResponse.created(
        res,
        { sessionKey, version: created.version, deck: created.deck, changeSummary: created.changeSummary },
        'Deck revised successfully',
        headers
      );
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  private getOrCreateSessionKey(req: Request, res: Response, fallbackPrefix: string): { sessionKey: string; headers: IRequestHeaders } {
    const headers: IRequestHeaders = buildRequestHeaders(req, fallbackPrefix);
    ensureResponseHeaders(res, headers);

    const raw = req.header(SESSION_KEY_HEADER);
    const sessionKey = (raw || '').trim() || randomUUID();

    res.setHeader(SESSION_KEY_HEADER, sessionKey);

    this.log.debug('Resolved session key', { sessionKey });

    return { sessionKey, headers };
  }
}
