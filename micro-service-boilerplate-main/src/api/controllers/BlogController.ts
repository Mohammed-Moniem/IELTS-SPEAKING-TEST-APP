import { Request, Response } from 'express';
import { Get, HttpCode, JsonController, Param, QueryParams, Req, Res } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { BlogListQuery } from '@dto/GrowthDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { StandardResponse } from '@responses/StandardResponse';
import { GrowthService } from '@services/GrowthService';

@JsonController('/blog/posts')
export class BlogController {
  constructor(private readonly growthService: GrowthService) {}

  @Get('/')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async listPosts(@QueryParams() query: BlogListQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'blog-posts-list');
    ensureResponseHeaders(res, headers);

    try {
      const data = await this.growthService.listPublicBlogPosts({
        cluster: query.cluster,
        search: query.search,
        limit: query.limit,
        offset: query.offset
      });
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/:slug')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getPost(@Param('slug') slug: string, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'blog-post-detail');
    ensureResponseHeaders(res, headers);

    try {
      const data = await this.growthService.getPublicBlogPostBySlug(slug);
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
