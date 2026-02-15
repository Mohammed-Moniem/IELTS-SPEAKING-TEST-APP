import { Request, Response } from 'express';
import { Body, Delete, Get, HttpCode, JsonController, Param, Post, QueryParam, Req, Res } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { StandardResponse } from '@responses/StandardResponse';
import { FavoritesService, FavoriteEntity } from '@services/FavoritesService';

@JsonController('/favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get('/')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async list(
    @QueryParam('entityType') entityType: FavoriteEntity,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'favorites-list');
    ensureResponseHeaders(res, headers);

    const userId = (req as any)?.currentUser?.id as string | undefined;
    if (!userId) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    if (!entityType) {
      return StandardResponse.validationError(res, [], 'entityType is required', headers);
    }

    try {
      const ids = await this.favoritesService.listFavoriteIds(userId, entityType);
      return StandardResponse.success(res, ids, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async add(
    @Body() body: { entityType?: FavoriteEntity; entityId?: string },
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'favorites-add');
    ensureResponseHeaders(res, headers);

    const userId = (req as any)?.currentUser?.id as string | undefined;
    if (!userId) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    const entityType = body?.entityType;
    const entityId = body?.entityId;
    if (!entityType || !entityId) {
      return StandardResponse.validationError(res, [], 'entityType and entityId are required', headers);
    }

    try {
      await this.favoritesService.addFavorite(userId, entityType, entityId);
      return StandardResponse.created(res, undefined, 'Favorited', headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Delete('/:entityType/:entityId')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async remove(
    @Param('entityType') entityType: FavoriteEntity,
    @Param('entityId') entityId: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'favorites-remove');
    ensureResponseHeaders(res, headers);

    const userId = (req as any)?.currentUser?.id as string | undefined;
    if (!userId) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    if (!entityType || !entityId) {
      return StandardResponse.validationError(res, [], 'entityType and entityId are required', headers);
    }

    try {
      await this.favoritesService.removeFavorite(userId, entityType, entityId);
      return StandardResponse.success(res, undefined, 'Unfavorited', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}

