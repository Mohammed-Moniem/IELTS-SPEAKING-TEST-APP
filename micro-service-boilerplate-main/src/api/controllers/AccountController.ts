import { Request, Response } from 'express';
import { Delete, Get, HttpCode, JsonController, Req, Res } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { Logger } from '@lib/logger';
import { getSupabaseAdmin } from '@lib/supabaseClient';
import { StandardResponse } from '@responses/StandardResponse';

@JsonController('/account')
export class AccountController {
  private log = new Logger(__filename);

  @Get('/export')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async exportAccount(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'account-export');
    ensureResponseHeaders(res, headers);

    const userId = (req as any)?.currentUser?.id as string | undefined;
    if (!userId) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const supabase = getSupabaseAdmin();

      const [
        profile,
        userProfile,
        favorites,
        practiceSessions,
        testSimulations,
        testHistory,
        audioRecordings,
        usageRecords,
        notificationPrefs
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('favorites').select('*').eq('user_id', userId),
        supabase.from('practice_sessions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(500),
        supabase.from('test_simulations').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(200),
        supabase.from('test_history').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(500),
        supabase.from('audio_recordings').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(500),
        supabase.from('usage_records').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('notification_preferences').select('*').eq('user_id', userId).maybeSingle()
      ]);

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        userId,
        profiles: profile.data || null,
        userProfiles: userProfile.data || null,
        favorites: favorites.data || [],
        practiceSessions: practiceSessions.data || [],
        testSimulations: testSimulations.data || [],
        testHistory: testHistory.data || [],
        audioRecordings: audioRecordings.data || [],
        usageRecords: usageRecords.data || null,
        notificationPreferences: notificationPrefs.data || null
      };

      return StandardResponse.success(res, exportPayload, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Delete('/')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async deleteAccount(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'account-delete');
    ensureResponseHeaders(res, headers);

    const userId = (req as any)?.currentUser?.id as string | undefined;
    if (!userId) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const supabase = getSupabaseAdmin();

      // Best-effort storage cleanup using metadata paths before user deletion.
      try {
        const { data: recordings } = await supabase
          .from('audio_recordings')
          .select('bucket, object_path')
          .eq('user_id', userId)
          .limit(1000);

        const byBucket = new Map<string, string[]>();
        (recordings || []).forEach((r: any) => {
          const bucket = String(r.bucket || 'audio');
          const objectPath = String(r.object_path || '').trim();
          if (!objectPath) return;
          byBucket.set(bucket, [...(byBucket.get(bucket) || []), objectPath]);
        });

        for (const [bucket, paths] of byBucket.entries()) {
          // Supabase Storage supports deleting many objects at once.
          const removeResult = await supabase.storage.from(bucket).remove(paths);
          if (removeResult.error) {
            this.log.warn('Storage cleanup failed (continuing)', { userId, bucket, error: removeResult.error.message });
          }
        }
      } catch (storageError: any) {
        this.log.warn('Storage cleanup error (continuing)', { userId, error: storageError?.message || storageError });
      }

      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) {
        throw new Error(error.message);
      }

      return StandardResponse.success(res, undefined, 'Account deleted', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}

