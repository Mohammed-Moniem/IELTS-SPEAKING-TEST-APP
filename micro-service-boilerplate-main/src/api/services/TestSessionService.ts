import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { TestSessionModel, ITestSession, ITestSessionDocument } from '@models/TestSessionModel';
import { Service } from 'typedi';
import { Types } from '@lib/db/mongooseCompat';

export interface CreateTestSessionPayload {
  userId: string;
  testType: 'practice' | 'full-test';
  part: 1 | 2 | 3 | 'full';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  metadata?: Record<string, any>;
  fullTranscript?: string;
  duration?: number;
}

export interface UpdateTestSessionPayload {
  questions?: ITestSession['questions'];
  recordings?: ITestSession['recordings'];
  fullTranscript?: string;
  duration?: number;
  completedAt?: Date;
  status?: 'in-progress' | 'completed' | 'abandoned';
  evaluationId?: Types.ObjectId;
}

@Service()
export class TestSessionService {
  private log = new Logger(__filename);

  /**
   * Create a new test session
   */
  public async createSession(
    payload: CreateTestSessionPayload,
    headers?: IRequestHeaders
  ): Promise<ITestSessionDocument> {
    const logMessage = constructLogMessage(__filename, 'createSession', headers);

    try {
      const session = await TestSessionModel.create({
        userId: payload.userId,
        testType: payload.testType,
      part: payload.part,
      difficulty: payload.difficulty,
      startedAt: new Date(),
      duration: payload.duration ?? 0,
      questions: [],
      recordings: [],
      fullTranscript: payload.fullTranscript ?? '',
      status: 'in-progress',
      metadata: payload.metadata
      });

      this.log.info(`${logMessage} :: Created test session`, {
        sessionId: session._id,
        userId: payload.userId,
        testType: payload.testType
      });

      return session;
    } catch (error) {
      this.log.error(`${logMessage} :: Failed to create test session:`, error);
      throw error;
    }
  }

  /**
   * Update an existing test session
   */
  public async updateSession(
    sessionId: string,
    updates: UpdateTestSessionPayload,
    headers?: IRequestHeaders
  ): Promise<ITestSessionDocument | null> {
    const logMessage = constructLogMessage(__filename, 'updateSession', headers);

    try {
      const session = await TestSessionModel.findByIdAndUpdate(
        sessionId,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!session) {
        this.log.warn(`${logMessage} :: Test session not found:`, { sessionId });
        return null;
      }

      this.log.info(`${logMessage} :: Updated test session`, {
        sessionId,
        updates: Object.keys(updates)
      });

      return session;
    } catch (error) {
      this.log.error(`${logMessage} :: Failed to update test session:`, error);
      throw error;
    }
  }

  /**
   * Complete a test session
   */
  public async completeSession(
    sessionId: string,
    completionData: {
      fullTranscript: string;
      duration: number;
      recordings: ITestSession['recordings'];
    },
    headers?: IRequestHeaders
  ): Promise<ITestSessionDocument | null> {
    const logMessage = constructLogMessage(__filename, 'completeSession', headers);

    try {
      const session = await TestSessionModel.findByIdAndUpdate(
        sessionId,
        {
          $set: {
            ...completionData,
            completedAt: new Date(),
            status: 'completed'
          }
        },
        { new: true, runValidators: true }
      );

      if (!session) {
        this.log.warn(`${logMessage} :: Test session not found:`, { sessionId });
        return null;
      }

      this.log.info(`${logMessage} :: Completed test session`, {
        sessionId,
        duration: completionData.duration,
        recordingsCount: completionData.recordings.length
      });

      return session;
    } catch (error) {
      this.log.error(`${logMessage} :: Failed to complete test session:`, error);
      throw error;
    }
  }

  /**
   * Get a test session by ID
   */
  public async getSession(
    sessionId: string,
    headers?: IRequestHeaders
  ): Promise<ITestSessionDocument | null> {
    const logMessage = constructLogMessage(__filename, 'getSession', headers);

    try {
      const session = await TestSessionModel.findById(sessionId).populate('evaluationId');

      if (!session) {
        this.log.warn(`${logMessage} :: Test session not found:`, { sessionId });
        return null;
      }

      return session;
    } catch (error) {
      this.log.error(`${logMessage} :: Failed to get test session:`, error);
      throw error;
    }
  }

  /**
   * Get user's test sessions
   */
  public async getUserSessions(
    userId: string,
    options: {
      testType?: 'practice' | 'full-test';
      status?: 'in-progress' | 'completed' | 'abandoned';
      limit?: number;
      skip?: number;
    } = {},
    headers?: IRequestHeaders
  ): Promise<{ sessions: ITestSessionDocument[]; total: number }> {
    const logMessage = constructLogMessage(__filename, 'getUserSessions', headers);

    try {
      const query: any = { userId };

      if (options.testType) {
        query.testType = options.testType;
      }

      if (options.status) {
        query.status = options.status;
      }

      const [sessions, total] = await Promise.all([
        TestSessionModel.find(query)
          .sort({ startedAt: -1 })
          .limit(options.limit || 50)
          .skip(options.skip || 0)
          .populate('evaluationId'),
        TestSessionModel.countDocuments(query)
      ]);

      this.log.info(`${logMessage} :: Retrieved user sessions`, {
        userId,
        count: sessions.length,
        total
      });

      return { sessions, total };
    } catch (error) {
      this.log.error(`${logMessage} :: Failed to get user sessions:`, error);
      throw error;
    }
  }

  /**
   * Abandon a test session (user exited without completing)
   */
  public async abandonSession(
    sessionId: string,
    headers?: IRequestHeaders
  ): Promise<ITestSessionDocument | null> {
    const logMessage = constructLogMessage(__filename, 'abandonSession', headers);

    try {
      const session = await TestSessionModel.findByIdAndUpdate(
        sessionId,
        {
          $set: {
            status: 'abandoned',
            completedAt: new Date()
          }
        },
        { new: true }
      );

      if (!session) {
        this.log.warn(`${logMessage} :: Test session not found:`, { sessionId });
        return null;
      }

      this.log.info(`${logMessage} :: Abandoned test session`, { sessionId });

      return session;
    } catch (error) {
      this.log.error(`${logMessage} :: Failed to abandon test session:`, error);
      throw error;
    }
  }

  /**
   * Delete old in-progress sessions (cleanup)
   */
  public async cleanupOldSessions(daysOld: number = 7, headers?: IRequestHeaders): Promise<number> {
    const logMessage = constructLogMessage(__filename, 'cleanupOldSessions', headers);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await TestSessionModel.deleteMany({
        status: 'in-progress',
        startedAt: { $lt: cutoffDate }
      });

      this.log.info(`${logMessage} :: Cleaned up old sessions`, {
        deletedCount: result.deletedCount
      });

      return result.deletedCount || 0;
    } catch (error) {
      this.log.error(`${logMessage} :: Failed to cleanup old sessions:`, error);
      throw error;
    }
  }
}
