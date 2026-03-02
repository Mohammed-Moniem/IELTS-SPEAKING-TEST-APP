import { Request, Response } from 'express';
import { Get, HttpCode, JsonController, Param, QueryParams, Req, Res } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { GuidePageQuery, GuideSearchQuery, GuideTreeQuery } from '@dto/GrowthDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { StandardResponse } from '@responses/StandardResponse';
import { GuideService, normalizeGuideCanonicalPath } from '@services/GuideService';

@JsonController('/guides')
export class GuideController {
  constructor(private readonly guideService: GuideService) {}

  @Get('/tree')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getTree(@QueryParams() query: GuideTreeQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'guides-tree');
    ensureResponseHeaders(res, headers);

    try {
      const data = await this.guideService.listPublicGuideTree({
        module: query.module,
        contentClass: query.contentClass,
        limit: query.limit,
        offset: query.offset
      });
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/page')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getPageFromQuery(@QueryParams() query: GuidePageQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'guides-page-query');
    ensureResponseHeaders(res, headers);

    try {
      const path = normalizeGuideCanonicalPath(query.path || '/ielts');
      const data = await this.guideService.getPublicGuidePageByPath(path);
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/page/*')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getPageFromWildcard(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'guides-page-wildcard');
    ensureResponseHeaders(res, headers);

    try {
      const wildcard = req.params?.[0] || '';
      const path = normalizeGuideCanonicalPath(`/ielts/${wildcard}`);
      const data = await this.guideService.getPublicGuidePageByPath(path);
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/related/:id')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getRelated(
    @Param('id') id: string,
    @QueryParams() query: { limit?: number },
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'guides-related');
    ensureResponseHeaders(res, headers);

    try {
      const data = await this.guideService.listRelatedPublicGuides(id, query.limit);
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/search')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async search(@QueryParams() query: GuideSearchQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'guides-search');
    ensureResponseHeaders(res, headers);

    try {
      const data = await this.guideService.searchPublicGuides({
        q: query.q,
        module: query.module,
        pageType: query.pageType,
        limit: query.limit,
        offset: query.offset
      });
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
