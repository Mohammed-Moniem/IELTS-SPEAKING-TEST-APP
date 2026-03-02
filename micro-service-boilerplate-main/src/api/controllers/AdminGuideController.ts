import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Param, Patch, Post, QueryParams, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import {
  AdminGuidePagesQuery,
  GenerateGuideOutlineRequest,
  GuideRefreshQueueRequest,
  ImportGuideSitemapRequest,
  ReviewGuidePageRequest,
  UpdateGuidePageRequest
} from '@dto/GrowthDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { AdminAccessService } from '@services/AdminAccessService';
import { GuideService } from '@services/GuideService';

@JsonController('/admin/guides')
@UseBefore(AuthMiddleware)
export class AdminGuideController {
  constructor(
    private readonly guideService: GuideService,
    private readonly adminAccessService: AdminAccessService
  ) {}

  @Post('/import/sitemap')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async importSitemap(@Body() body: ImportGuideSitemapRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-guides-import-sitemap');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'content_manager']);
      const data = await this.guideService.importGuideSitemaps(body, req.currentUser!.id);
      await this.adminAccessService.audit({
        actorUserId: req.currentUser!.id,
        action: 'guides-import-sitemap',
        targetType: 'guide-import-job',
        targetId: data.jobId,
        details: {
          sitemaps: body.sitemaps || []
        }
      });
      return StandardResponse.success(res, data, 'Guide sitemap import completed', HTTP_STATUS_CODES.CREATED, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/import-jobs')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async listImportJobs(@QueryParams() query: { limit?: number; offset?: number }, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-guides-import-jobs');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'content_manager']);
      const data = await this.guideService.listGuideImportJobs({
        limit: query.limit,
        offset: query.offset
      });
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/pages')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async listPages(@QueryParams() query: AdminGuidePagesQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-guides-pages-list');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'content_manager']);
      const data = await this.guideService.listAdminGuidePages({
        state: query.state,
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

  @Post('/pages/:id/generate-outline')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async generateOutline(
    @Param('id') id: string,
    @Body() body: GenerateGuideOutlineRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-guides-outline-generate');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'content_manager']);
      const data = await this.guideService.generateGuideOutline(id, body, req.currentUser!.id);
      await this.adminAccessService.audit({
        actorUserId: req.currentUser!.id,
        action: 'guide-generate-outline',
        targetType: 'guide-page',
        targetId: id
      });
      return StandardResponse.success(res, data, 'Guide outline generated', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Patch('/pages/:id')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async updatePage(
    @Param('id') id: string,
    @Body() body: UpdateGuidePageRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-guides-page-update');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'content_manager']);
      const data = await this.guideService.updateGuidePage(id, body as unknown as Record<string, unknown>, req.currentUser!.id);
      await this.adminAccessService.audit({
        actorUserId: req.currentUser!.id,
        action: 'guide-page-update',
        targetType: 'guide-page',
        targetId: id
      });
      return StandardResponse.success(res, data, 'Guide page updated', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Patch('/pages/:id/review')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async reviewPage(
    @Param('id') id: string,
    @Body() body: ReviewGuidePageRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-guides-page-review');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'content_manager']);
      const data = await this.guideService.reviewGuidePage(id, body, req.currentUser!.id);
      await this.adminAccessService.audit({
        actorUserId: req.currentUser!.id,
        action: 'guide-page-review',
        targetType: 'guide-page',
        targetId: id,
        details: {
          decision: body.decision
        }
      });
      return StandardResponse.success(res, data, 'Guide review saved', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/pages/:id/publish')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async publishPage(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-guides-page-publish');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'content_manager']);
      const data = await this.guideService.publishGuidePage(id, req.currentUser!.id);
      await this.adminAccessService.audit({
        actorUserId: req.currentUser!.id,
        action: 'guide-page-publish',
        targetType: 'guide-page',
        targetId: id
      });
      return StandardResponse.success(res, data, 'Guide page published', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/refresh-queue')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async refreshQueue(@Body() body: GuideRefreshQueueRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-guides-refresh-queue');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'content_manager']);
      const data = await this.guideService.enqueueGuideRefreshQueue(body, req.currentUser!.id);
      await this.adminAccessService.audit({
        actorUserId: req.currentUser!.id,
        action: 'guide-refresh-queue',
        targetType: 'guide-import-job',
        targetId: data.jobId
      });
      return StandardResponse.success(res, data, 'Guide refresh queue updated', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
