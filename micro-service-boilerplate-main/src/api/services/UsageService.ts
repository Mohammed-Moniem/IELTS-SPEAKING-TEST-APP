import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { UsageRecordDocument, UsageRecordModel } from '@models/UsageRecordModel';
import { SubscriptionPlan } from '@models/UserModel';
import { Service } from 'typedi';

const FREE_LIMITS = {
  practice: 3,
  test: 1
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
        testCount: record.testCount
      });
      record.practiceCount = 0;
      record.testCount = 0;
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

  public async getUsageSummary(userId: string, plan: SubscriptionPlan, _headers: IRequestHeaders) {
    const usage = await this.getOrCreateUsageRecord(userId);

    const limits = plan === 'free' ? FREE_LIMITS : { practice: Infinity, test: Infinity };

    return {
      plan,
      practiceCount: usage.practiceCount,
      testCount: usage.testCount,
      practiceLimit: limits.practice,
      testLimit: limits.test,
      lastReset: usage.lastReset
    };
  }

  public async getUsageHistory(userId: string, _headers: IRequestHeaders) {
    const usage = await this.getOrCreateUsageRecord(userId);
    const history = [...usage.monthlyResets].sort((a, b) => b.resetAt.getTime() - a.resetAt.getTime()).slice(0, 12);

    return history;
  }
}
