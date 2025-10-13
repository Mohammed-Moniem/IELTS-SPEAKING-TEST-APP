import { Service } from 'typedi';
import { Repository } from 'typeorm';
import { InjectRepository } from 'typeorm-typedi-extensions';
import { SessionType, UsageLog } from '../models/UsageLog';

export interface UsageStats {
  totalSessions: number;
  practiceSessions: number;
  simulationSessions: number;
  averageDuration: number;
  completionRate: number;
  lastSessionDate: Date | null;
}

@Service()
export class UsageTrackingService {
  constructor(
    @InjectRepository(UsageLog)
    private usageLogRepository: Repository<UsageLog>
  ) {}

  /**
   * Log a new session
   */
  async logSession(
    userId: string,
    sessionType: SessionType,
    metadata?: {
      testPart?: number;
      overallBand?: number;
      topic?: string;
      completed?: boolean;
      duration?: number;
    }
  ): Promise<UsageLog> {
    const usageLog = this.usageLogRepository.create({
      userId,
      sessionType,
      duration: metadata?.duration,
      metadata
    });

    return await this.usageLogRepository.save(usageLog);
  }

  /**
   * Get usage count for current month
   */
  async getMonthlyUsage(userId: string, sessionType?: SessionType): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const query = this.usageLogRepository
      .createQueryBuilder('usage')
      .where('usage.userId = :userId', { userId })
      .andWhere('usage.createdAt >= :startOfMonth', { startOfMonth });

    if (sessionType) {
      query.andWhere('usage.sessionType = :sessionType', { sessionType });
    }

    return await query.getCount();
  }

  /**
   * Get comprehensive usage statistics
   */
  async getUserStats(userId: string): Promise<UsageStats> {
    const logs = await this.usageLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' }
    });

    if (logs.length === 0) {
      return {
        totalSessions: 0,
        practiceSessions: 0,
        simulationSessions: 0,
        averageDuration: 0,
        completionRate: 0,
        lastSessionDate: null
      };
    }

    const practiceSessions = logs.filter(log => log.sessionType === SessionType.PRACTICE).length;
    const simulationSessions = logs.filter(log => log.sessionType === SessionType.SIMULATION).length;

    const durationsWithValues = logs
      .filter(log => log.duration !== null && log.duration !== undefined)
      .map(log => log.duration!);

    const averageDuration =
      durationsWithValues.length > 0
        ? durationsWithValues.reduce((sum, d) => sum + d, 0) / durationsWithValues.length
        : 0;

    const completedSessions = logs.filter(log => log.metadata?.completed === true).length;
    const completionRate = (completedSessions / logs.length) * 100;

    return {
      totalSessions: logs.length,
      practiceSessions,
      simulationSessions,
      averageDuration,
      completionRate,
      lastSessionDate: logs[0].createdAt
    };
  }

  /**
   * Get recent session history
   */
  async getRecentSessions(userId: string, limit: number = 10): Promise<UsageLog[]> {
    return await this.usageLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit
    });
  }

  /**
   * Delete old usage logs (data retention)
   */
  async cleanupOldLogs(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.usageLogRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }
}
