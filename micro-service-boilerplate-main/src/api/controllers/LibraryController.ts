import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Param, Post, QueryParams, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import {
  CreateLibraryDeckRequest,
  LibraryQuery,
  LibraryReviewQueueQuery,
  RecordDeckReviewEventRequest
} from '@dto/GrowthDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { GrowthService } from '@services/GrowthService';

@JsonController('/library')
@UseBefore(AuthMiddleware)
export class LibraryController {
  constructor(private readonly growthService: GrowthService) {}

  @Get('/collocations')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getCollocations(@QueryParams() query: LibraryQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'library-collocations-list');
    ensureResponseHeaders(res, headers);

    try {
      const data = await this.growthService.listCollocations(query);
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/vocabulary')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getVocabulary(@QueryParams() query: LibraryQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'library-vocabulary-list');
    ensureResponseHeaders(res, headers);

    try {
      const data = await this.growthService.listVocabulary(query);
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/resources/books')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getBooks(@QueryParams() query: LibraryQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'library-books-list');
    ensureResponseHeaders(res, headers);

    try {
      const data = await this.growthService.listResources('book', query);
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/resources/channels')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getChannels(@QueryParams() query: LibraryQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'library-channels-list');
    ensureResponseHeaders(res, headers);

    try {
      const data = await this.growthService.listResources('channel', query);
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/decks')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async createDeck(@Body() body: CreateLibraryDeckRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'library-deck-create');
    ensureResponseHeaders(res, headers);

    try {
      const data = await this.growthService.createLibraryDeck(req.currentUser!.id, body);
      return StandardResponse.success(res, data, 'Practice deck created', HTTP_STATUS_CODES.CREATED, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/decks/review-queue')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getReviewQueue(@QueryParams() query: LibraryReviewQueueQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'library-review-queue');
    ensureResponseHeaders(res, headers);

    try {
      const data = await this.growthService.getLibraryReviewQueue(req.currentUser!.id, query.limit);
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/decks/:deckId/review-events')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async recordDeckReview(
    @Param('deckId') deckId: string,
    @Body() body: RecordDeckReviewEventRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'library-deck-review-record');
    ensureResponseHeaders(res, headers);

    try {
      const data = await this.growthService.recordDeckReviewEvent(req.currentUser!.id, deckId, body);
      return StandardResponse.success(res, data, 'Deck review recorded', HTTP_STATUS_CODES.CREATED, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
