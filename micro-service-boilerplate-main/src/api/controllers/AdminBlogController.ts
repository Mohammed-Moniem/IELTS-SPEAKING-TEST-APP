import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Param, Patch, Post, QueryParams, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { BlogListQuery, CreateBlogDraftRequest, GenerateBlogIdeasRequest, ReviewBlogPostRequest } from '@dto/GrowthDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { AdminAccessService } from '@services/AdminAccessService';
import { GrowthService } from '@services/GrowthService';

@JsonController('/admin/blog')
@UseBefore(AuthMiddleware)
export class AdminBlogController {
  constructor(
    private readonly growthService: GrowthService,
    private readonly adminAccessService: AdminAccessService
  ) {}

  @Get('/posts')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async listPosts(@QueryParams() query: BlogListQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-blog-posts-list');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'content_manager']);
      const data = await this.growthService.listAdminBlogPosts({
        cluster: query.cluster,
        state: query.state,
        limit: query.limit,
        offset: query.offset
      });
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/generate-ideas')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async generateIdeas(@Body() body: GenerateBlogIdeasRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-blog-generate-ideas');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'content_manager']);
      const data = await this.growthService.generateBlogIdeas(body, req.currentUser!.id);
      await this.adminAccessService.audit({
        actorUserId: req.currentUser!.id,
        action: 'blog-generate-ideas',
        targetType: 'blog-job',
        targetId: data.jobId,
        details: {
          cluster: body.cluster,
          count: body.count
        }
      });
      return StandardResponse.success(res, data, 'Blog ideas generated', HTTP_STATUS_CODES.CREATED, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/drafts')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async createDraft(@Body() body: CreateBlogDraftRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-blog-draft-create');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'content_manager']);
      const data = await this.growthService.createBlogDraft(body, req.currentUser!.id);
      await this.adminAccessService.audit({
        actorUserId: req.currentUser!.id,
        action: 'blog-create-draft',
        targetType: 'blog-post',
        targetId: data.post.id,
        details: {
          cluster: body.cluster,
          contentRisk: body.contentRisk
        }
      });
      return StandardResponse.success(res, data, 'Blog draft created', HTTP_STATUS_CODES.CREATED, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Patch('/:postId/review')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async reviewPost(
    @Param('postId') postId: string,
    @Body() body: ReviewBlogPostRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-blog-review');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'content_manager']);
      const data = await this.growthService.reviewBlogPost(postId, body, req.currentUser!.id);
      await this.adminAccessService.audit({
        actorUserId: req.currentUser!.id,
        action: 'blog-review',
        targetType: 'blog-post',
        targetId: postId,
        details: {
          decision: body.decision
        }
      });
      return StandardResponse.success(res, data, 'Blog review saved', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/:postId/publish')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async publishPost(@Param('postId') postId: string, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-blog-publish');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'content_manager']);
      const data = await this.growthService.publishBlogPost(postId, req.currentUser!.id);
      await this.adminAccessService.audit({
        actorUserId: req.currentUser!.id,
        action: 'blog-publish',
        targetType: 'blog-post',
        targetId: postId
      });
      return StandardResponse.success(res, data, 'Blog post published', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
