import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { getSupabaseAdmin } from '@lib/supabaseClient';
import { Service } from 'typedi';

interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

@Service()
export class UserService {
  private log = new Logger(__filename);

  public async getProfile(userId: string, headers: IRequestHeaders) {
    const logMessage = constructLogMessage(__filename, 'getProfile', headers);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, phone, email_verified, subscription_plan, is_guest, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'User not found');
    }

    this.log.debug(`${logMessage} :: Returning profile for user ${userId}`);
    return {
      _id: data.id,
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      phone: data.phone || undefined,
      emailVerified: Boolean(data.email_verified),
      subscriptionPlan: data.subscription_plan,
      isGuest: Boolean(data.is_guest),
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  public async updateProfile(userId: string, payload: UpdateUserPayload, headers: IRequestHeaders) {
    const logMessage = constructLogMessage(__filename, 'updateProfile', headers);
    const updates: Record<string, any> = {};
    if (payload.firstName !== undefined) updates.first_name = payload.firstName;
    if (payload.lastName !== undefined) updates.last_name = payload.lastName;
    if (payload.phone !== undefined) updates.phone = payload.phone;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('id, email, first_name, last_name, phone, email_verified, subscription_plan, is_guest, created_at, updated_at')
      .maybeSingle();

    if (error || !data) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'User not found');
    }

    this.log.info(`${logMessage} :: Updated profile for user ${userId}`);
    return {
      _id: data.id,
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      phone: data.phone || undefined,
      emailVerified: Boolean(data.email_verified),
      subscriptionPlan: data.subscription_plan,
      isGuest: Boolean(data.is_guest),
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }
}
