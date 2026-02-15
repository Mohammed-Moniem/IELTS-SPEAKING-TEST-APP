import { EvaluationCriteriaPayload } from '@interfaces/ITestEvaluation';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { ICorrection, ISuggestion, ITestEvaluationDocument, TestEvaluationModel } from '@models/TestEvaluationModel';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { FilterQuery, Types } from 'mongoose';
import { Service } from 'typedi';

export interface CreateTestEvaluationPayload {
  testSessionId: string | Types.ObjectId;
  userId: string;
  overallBand: number;
  criteria: EvaluationCriteriaPayload;
  spokenSummary: string;
  detailedFeedback: string;
  corrections?: ICorrection[];
  suggestions?: ISuggestion[];
  evaluatedAt?: Date;
  evaluatedBy?: 'ai' | 'human';
  evaluatorModel?: string;
  partScores?: {
    part1?: number;
    part2?: number;
    part3?: number;
  };
}

export interface UpdateTestEvaluationPayload {
  overallBand?: number;
  criteria?: Partial<EvaluationCriteriaPayload>;
  spokenSummary?: string;
  detailedFeedback?: string;
  corrections?: ICorrection[];
  suggestions?: ISuggestion[];
  evaluatedAt?: Date;
  evaluatedBy?: 'ai' | 'human';
  evaluatorModel?: string;
  partScores?: {
    part1?: number;
    part2?: number;
    part3?: number;
  };
}

export interface ListEvaluationsOptions {
  evaluatedBy?: 'ai' | 'human';
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
}

@Service()
export class TestEvaluationService {
  private log = new Logger(__filename);

  /**
   * Create or update an evaluation for a given test session.
   * This ensures idempotent writes when the evaluation endpoint
   * is called multiple times for the same session.
   */
  public async upsertEvaluation(
    payload: CreateTestEvaluationPayload,
    headers?: IRequestHeaders
  ): Promise<ITestEvaluationDocument> {
    const logMessage = constructLogMessage(__filename, 'upsertEvaluation', headers);
    const testSessionId = this.toObjectId(payload.testSessionId);

    try {
      const now = new Date();
      const updateDocument: Partial<ITestEvaluationDocument> = {
        testSessionId,
        userId: payload.userId,
        overallBand: payload.overallBand,
        criteria: payload.criteria,
        spokenSummary: payload.spokenSummary,
        detailedFeedback: payload.detailedFeedback,
        corrections: payload.corrections ?? [],
        suggestions: payload.suggestions ?? [],
        evaluatedAt: payload.evaluatedAt ?? now,
        evaluatedBy: payload.evaluatedBy ?? 'ai',
        evaluatorModel: payload.evaluatorModel,
        partScores: payload.partScores
      };

      const evaluation = await TestEvaluationModel.findOneAndUpdate(
        { testSessionId },
        { $set: updateDocument },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true
        }
      );

      this.log.info(`${logMessage} :: Upserted evaluation`, {
        evaluationId: evaluation._id,
        testSessionId: testSessionId.toHexString(),
        userId: payload.userId
      });

      return evaluation;
    } catch (error) {
      this.log.error(`${logMessage} :: Failed to upsert evaluation`, { error });
      throw error;
    }
  }

  /**
   * Partially update an evaluation document.
   */
  public async updateEvaluation(
    evaluationId: string | Types.ObjectId,
    updates: UpdateTestEvaluationPayload,
    headers?: IRequestHeaders
  ): Promise<ITestEvaluationDocument | null> {
    const logMessage = constructLogMessage(__filename, 'updateEvaluation', headers);
    const _id = this.toObjectId(evaluationId);

    try {
      const updateDocument: Record<string, unknown> = {};

      if (typeof updates.overallBand === 'number') {
        updateDocument.overallBand = updates.overallBand;
      }

      if (updates.criteria) {
        // Merge each criterion individually to avoid wiping out unspecified ones
        Object.entries(updates.criteria).forEach(([key, value]) => {
          if (value) {
            updateDocument[`criteria.${key}`] = value;
          }
        });
      }

      if (typeof updates.spokenSummary === 'string') {
        updateDocument.spokenSummary = updates.spokenSummary;
      }

      if (typeof updates.detailedFeedback === 'string') {
        updateDocument.detailedFeedback = updates.detailedFeedback;
      }

      if (updates.corrections) {
        updateDocument.corrections = updates.corrections;
      }

      if (updates.suggestions) {
        updateDocument.suggestions = updates.suggestions;
      }

      if (updates.evaluatedAt) {
        updateDocument.evaluatedAt = updates.evaluatedAt;
      }

      if (updates.evaluatedBy) {
        updateDocument.evaluatedBy = updates.evaluatedBy;
      }

      if (typeof updates.evaluatorModel === 'string') {
        updateDocument.evaluatorModel = updates.evaluatorModel;
      }

      if (updates.partScores) {
        Object.entries(updates.partScores).forEach(([key, value]) => {
          updateDocument[`partScores.${key}`] = value;
        });
      }

      if (Object.keys(updateDocument).length === 0) {
        this.log.warn(`${logMessage} :: No updates provided`, { evaluationId: _id.toHexString() });
        return await TestEvaluationModel.findById(_id);
      }

      const evaluation = await TestEvaluationModel.findByIdAndUpdate(
        _id,
        { $set: updateDocument },
        { new: true, runValidators: true }
      );

      if (!evaluation) {
        this.log.warn(`${logMessage} :: Evaluation not found`, { evaluationId: _id.toHexString() });
      } else {
        this.log.info(`${logMessage} :: Updated evaluation`, { evaluationId: evaluation._id });
      }

      return evaluation;
    } catch (error) {
      this.log.error(`${logMessage} :: Failed to update evaluation`, { error });
      throw error;
    }
  }

  /**
   * Retrieve an evaluation for a specific test session.
   */
  public async getEvaluationBySession(
    testSessionId: string | Types.ObjectId,
    headers?: IRequestHeaders
  ): Promise<ITestEvaluationDocument | null> {
    const logMessage = constructLogMessage(__filename, 'getEvaluationBySession', headers);
    const sessionObjectId = this.toObjectId(testSessionId);

    try {
      const evaluation = await TestEvaluationModel.findOne({ testSessionId: sessionObjectId });

      if (!evaluation) {
        this.log.warn(`${logMessage} :: Evaluation not found`, {
          testSessionId: sessionObjectId.toHexString()
        });
      }

      return evaluation;
    } catch (error) {
      this.log.error(`${logMessage} :: Failed to fetch evaluation`, { error });
      throw error;
    }
  }

  /**
   * List evaluations for a user with optional filtering.
   */
  public async listUserEvaluations(
    userId: string,
    options: ListEvaluationsOptions = {},
    headers?: IRequestHeaders
  ): Promise<{ evaluations: ITestEvaluationDocument[]; total: number }> {
    const logMessage = constructLogMessage(__filename, 'listUserEvaluations', headers);

    try {
      const query: FilterQuery<ITestEvaluationDocument> = { userId };

      if (options.evaluatedBy) {
        query.evaluatedBy = options.evaluatedBy;
      }

      const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 25;
      const skip = options.skip && options.skip > 0 ? options.skip : 0;
      const sort = options.sort || { evaluatedAt: -1 };

      const [evaluations, total] = await Promise.all([
        TestEvaluationModel.find(query).sort(sort).limit(limit).skip(skip),
        TestEvaluationModel.countDocuments(query)
      ]);

      this.log.info(`${logMessage} :: Listed user evaluations`, {
        userId,
        count: evaluations.length,
        total
      });

      return { evaluations, total };
    } catch (error) {
      this.log.error(`${logMessage} :: Failed to list evaluations`, { error });
      throw error;
    }
  }

  /**
   * Internal helper to ensure we always work with ObjectId instances.
   */
  private toObjectId(id: string | Types.ObjectId): Types.ObjectId {
    if (id instanceof Types.ObjectId) {
      return id;
    }

    if (!Types.ObjectId.isValid(id)) {
      throw new Error(`Invalid ObjectId: ${id}`);
    }

    return new Types.ObjectId(id);
  }
}
