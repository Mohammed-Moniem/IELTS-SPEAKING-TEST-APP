import { env } from '@env';
import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { getSupabaseAdmin } from '@lib/supabaseClient';
import { Service } from 'typedi';

type SubscriptionPlan = 'free' | 'premium' | 'pro';

const FREE_LIMITS = {
  practice: 3,
  test: 1
};

type UsageRecordRow = {
  user_id: string;
  practice_count: number;
  test_count: number;
  last_reset: string;
  monthly_resets: any[];
};

@Service()
export class UsageService {
  private log = new Logger(__filename);

  private async getOrCreateUsageRecord(userId: string): Promise<UsageRecordRow> {
    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase
      .from('usage_records')
      .select('user_id, practice_count, test_count, last_reset, monthly_resets')
      .eq('user_id', userId)
      .maybeSingle();

    let record = (existing as UsageRecordRow | null) || null;
    if (!record) {
      const { data: created, error } = await supabase
        .from('usage_records')
        .insert({ user_id: userId })
        .select('user_id, practice_count, test_count, last_reset, monthly_resets')
        .single();
      if (error || !created) {
        throw error || new Error('Failed to create usage record');
      }
      record = created as UsageRecordRow;
    }

    const now = new Date();
    const lastReset = record.last_reset ? new Date(record.last_reset) : now;
    const monthsDiff = (now.getFullYear() - lastReset.getFullYear()) * 12 + (now.getMonth() - lastReset.getMonth());

    if (monthsDiff >= 1) {
      const monthlyResets = Array.isArray(record.monthly_resets) ? [...record.monthly_resets] : [];
      monthlyResets.push({
        resetAt: record.last_reset,
        practiceCount: record.practice_count,
        testCount: record.test_count
      });

      const { data: updated, error } = await supabase
        .from('usage_records')
        .update({
          practice_count: 0,
          test_count: 0,
          last_reset: now.toISOString(),
          monthly_resets: monthlyResets
        })
        .eq('user_id', userId)
        .select('user_id, practice_count, test_count, last_reset, monthly_resets')
        .single();

      if (error || !updated) {
        throw error || new Error('Failed to reset usage record');
      }

      record = updated as UsageRecordRow;
    }

    return record as UsageRecordRow;
  }

  public async assertPracticeAllowance(userId: string, plan: SubscriptionPlan, headers: IRequestHeaders) {
    if (env.payments?.disabled) return;
    if (plan !== 'free') return;

    const usage = await this.getOrCreateUsageRecord(userId);
    if (usage.practice_count >= FREE_LIMITS.practice) {
      const logMessage = constructLogMessage(__filename, 'assertPracticeAllowance', headers);
      this.log.warn(`${logMessage} :: Practice limit reached for user ${userId}`);
      throw new CSError(
        HTTP_STATUS_CODES.FORBIDDEN,
        CODES.UsageLimitReached,
        'Monthly practice limit reached for your current plan'
      );
    }
  }

  public async assertTestAllowance(userId: string, plan: SubscriptionPlan, headers: IRequestHeaders) {
    if (env.payments?.disabled) return;
    if (plan !== 'free') return;

    const usage = await this.getOrCreateUsageRecord(userId);
    if (usage.test_count >= FREE_LIMITS.test) {
      const logMessage = constructLogMessage(__filename, 'assertTestAllowance', headers);
      this.log.warn(`${logMessage} :: Test limit reached for user ${userId}`);
      throw new CSError(
        HTTP_STATUS_CODES.FORBIDDEN,
        CODES.UsageLimitReached,
        'Monthly test limit reached for your current plan'
      );
    }
  }

  public async incrementPractice(userId: string) {
    const record = await this.getOrCreateUsageRecord(userId);
    const supabase = getSupabaseAdmin();
    await supabase
      .from('usage_records')
      .update({ practice_count: (record.practice_count || 0) + 1 })
      .eq('user_id', userId);
  }

  public async incrementTest(userId: string) {
    const record = await this.getOrCreateUsageRecord(userId);
    const supabase = getSupabaseAdmin();
    await supabase
      .from('usage_records')
      .update({ test_count: (record.test_count || 0) + 1 })
      .eq('user_id', userId);
  }

  public async getUsageSummary(userId: string, plan: SubscriptionPlan, _headers: IRequestHeaders) {
    const usage = await this.getOrCreateUsageRecord(userId);

    const effectivePlan: SubscriptionPlan = env.payments?.disabled ? 'pro' : plan;
    const limits = effectivePlan === 'free' ? FREE_LIMITS : { practice: Infinity, test: Infinity };

    return {
      plan: effectivePlan,
      practiceCount: usage.practice_count,
      testCount: usage.test_count,
      practiceLimit: Number.isFinite(limits.practice) ? limits.practice : null,
      testLimit: Number.isFinite(limits.test) ? limits.test : null,
      lastReset: usage.last_reset
    };
  }

  public async getUsageHistory(userId: string, _headers: IRequestHeaders) {
    const usage = await this.getOrCreateUsageRecord(userId);
    const history = (Array.isArray(usage.monthly_resets) ? [...usage.monthly_resets] : [])
      .sort((a: any, b: any) => new Date(b.resetAt).getTime() - new Date(a.resetAt).getTime())
      .slice(0, 12);

    return history;
  }
}

