import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { env } from '@env';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { UsageRecordDocument, UsageRecordModel } from '@models/UsageRecordModel';
import { SubscriptionPlan } from '@models/UserModel';
import { Service } from 'typedi';

const FREE_LIMITS = {
  practice: env.usage.freePracticeLimit,
  test: env.usage.freeTestLimit,
  writing: env.usage.freeWritingLimit,
  reading: env.usage.freeReadingLimit,
  listening: env.usage.freeListeningLimit
};

@Service()
export class UsageService {
  private log = new Logger(__filename);

  private async getOrCreateUsageRecord(userId: string): Promise<UsageRecordDocument> {
    let record = (await UsageRecordModel.findOne({ user: userId })) as UsageRecordDocument | null;
    if (!record) {
      record = (await UsageRecordModel.create({ user: userId })) as UsageRecordDocument;
    }

    const now = new Date();
    const lastReset = record.lastReset || now;
    const monthsDiff = (now.getFullYear() - lastReset.getFullYear()) * 12 + (now.getMonth() - lastReset.getMonth());

    if (monthsDiff >= 1) {
      record.monthlyResets.push({
        resetAt: record.lastReset,
        practiceCount: record.practiceCount,
        testCount: record.testCount,
        writingCount: record.writingCount || 0,
        readingCount: record.readingCount || 0,
        listeningCount: record.listeningCount || 0,
        aiRequestCount: record.aiRequestCount || 0,
        aiTokenCount: record.aiTokenCount || 0,
        aiEstimatedCostUsd: record.aiEstimatedCostUsd || 0
      });
      record.practiceCount = 0;
      record.testCount = 0;
      record.writingCount = 0;
      record.readingCount = 0;
      record.listeningCount = 0;
      record.aiRequestCount = 0;
      record.aiTokenCount = 0;
      record.aiEstimatedCostUsd = 0;
      record.lastReset = now;
      await record.save();
    }

    return record as UsageRecordDocument;
  }

  public async assertPracticeAllowance(userId: string, plan: SubscriptionPlan, headers: IRequestHeaders) {
    if (plan !== 'free') return;

    const usage = await this.getOrCreateUsageRecord(userId);
    if (usage.practiceCount >= FREE_LIMITS.practice) {
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
    if (plan !== 'free') return;

    const usage = await this.getOrCreateUsageRecord(userId);
    if (usage.testCount >= FREE_LIMITS.test) {
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
    await UsageRecordModel.updateOne({ user: userId }, { $inc: { practiceCount: 1 } }, { upsert: true });
  }

  public async incrementTest(userId: string) {
    await UsageRecordModel.updateOne({ user: userId }, { $inc: { testCount: 1 } }, { upsert: true });
  }

  public async assertModuleAllowance(
    userId: string,
    plan: SubscriptionPlan,
    module: 'writing' | 'reading' | 'listening',
    headers: IRequestHeaders
  ) {
    if (plan !== 'free') return;

    const usage = await this.getOrCreateUsageRecord(userId);
    const key = `${module}Count` as const;
    const limit = FREE_LIMITS[module];
    const used = usage[key] || 0;

    if (used >= limit) {
      const logMessage = constructLogMessage(__filename, 'assertModuleAllowance', headers);
      this.log.warn(`${logMessage} :: ${module} limit reached for user ${userId}`);
      throw new CSError(
        HTTP_STATUS_CODES.FORBIDDEN,
        CODES.UsageLimitReached,
        `Monthly ${module} limit reached for your current plan`
      );
    }
  }

  public async incrementModuleUsage(userId: string, module: 'writing' | 'reading' | 'listening') {
    const key = `${module}Count`;
    await UsageRecordModel.updateOne({ user: userId }, { $inc: { [key]: 1 } }, { upsert: true });
  }

  public async incrementAIUsage(userId: string | undefined, tokens: number, estimatedCostUsd: number) {
    if (!userId) return;
    await UsageRecordModel.updateOne(
      { user: userId },
      {
        $inc: {
          aiRequestCount: 1,
          aiTokenCount: Math.max(0, Math.round(tokens || 0)),
          aiEstimatedCostUsd: Number((estimatedCostUsd || 0).toFixed(6))
        }
      },
      { upsert: true }
    );
  }

  public async getUsageSummary(userId: string, plan: SubscriptionPlan, _headers: IRequestHeaders) {
    const usage = await this.getOrCreateUsageRecord(userId);

    const limits = plan === 'free' ? FREE_LIMITS : { practice: Infinity, test: Infinity };

    return {
      plan,
      practiceCount: usage.practiceCount,
      testCount: usage.testCount,
      writingCount: usage.writingCount || 0,
      readingCount: usage.readingCount || 0,
      listeningCount: usage.listeningCount || 0,
      aiRequestCount: usage.aiRequestCount || 0,
      aiTokenCount: usage.aiTokenCount || 0,
      aiEstimatedCostUsd: usage.aiEstimatedCostUsd || 0,
      practiceLimit: limits.practice,
      testLimit: limits.test,
      writingLimit: plan === 'free' ? FREE_LIMITS.writing : Infinity,
      readingLimit: plan === 'free' ? FREE_LIMITS.reading : Infinity,
      listeningLimit: plan === 'free' ? FREE_LIMITS.listening : Infinity,
      lastReset: usage.lastReset
    };
  }

  public async getUsageHistory(userId: string, _headers: IRequestHeaders) {
    const usage = await this.getOrCreateUsageRecord(userId);
    const history = [...usage.monthlyResets].sort((a, b) => b.resetAt.getTime() - a.resetAt.getTime()).slice(0, 12);

    return history;
  }
}
