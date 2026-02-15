import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Post, Req, Res } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { StandardResponse } from '@responses/StandardResponse';
import { getSupabaseAdmin } from '@lib/supabaseClient';

@JsonController('/support')
export class SupportController {
  @Post('/tickets')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async createTicket(
    @Body()
    body: {
      subject?: string;
      message?: string;
      context?: Record<string, any>;
    },
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'support-ticket-create');
    ensureResponseHeaders(res, headers);

    const userId = (req as any)?.currentUser?.id as string | undefined;
    if (!userId) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    const subject = String(body?.subject || '').trim();
    const message = String(body?.message || '').trim();
    const context = body?.context && typeof body.context === 'object' ? body.context : {};

    if (!subject || !message) {
      return StandardResponse.validationError(res, [], 'subject and message are required', headers);
    }

    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: userId,
          subject,
          message,
          context
        })
        .select('id, created_at')
        .single();

      if (error || !data) {
        throw error || new Error('Failed to create support ticket');
      }

      return StandardResponse.created(
        res,
        { ticketId: (data as any).id, createdAt: (data as any).created_at },
        'Support ticket created',
        headers
      );
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  // Nice-to-have: allow users to view their submitted tickets.
  @Get('/tickets')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async listTickets(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'support-ticket-list');
    ensureResponseHeaders(res, headers);

    const userId = (req as any)?.currentUser?.id as string | undefined;
    if (!userId) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('support_tickets')
        .select('id, subject, message, context, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      return StandardResponse.success(res, data || [], undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}

