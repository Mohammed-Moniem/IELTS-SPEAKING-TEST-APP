import { Service } from 'typedi';

import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { FullExamSessionModel, IELTSModule } from '@models/FullExamSessionModel';
import { FullExamRuntimeMutationRequest } from '@dto/FullExamDto';

const DEFAULT_REMAINING_SECONDS: Record<IELTSModule, number> = {
  speaking: 14 * 60,
  writing: 60 * 60,
  reading: 60 * 60,
  listening: 30 * 60
};

@Service()
export class FullExamService {
  private readonly log = new Logger(__filename);

  private getNextPendingModule(session: {
    sections: Array<{ module: IELTSModule; status: 'pending' | 'in_progress' | 'completed' }>;
  }): IELTSModule | undefined {
    const next = session.sections.find(section => section.status !== 'completed');
    return next?.module;
  }

  private updateRuntimeFromMutation(
    session: { runtime: any },
    mutation: FullExamRuntimeMutationRequest | undefined,
    options?: { interrupted?: boolean; clearInterruption?: boolean }
  ) {
    const runtime = session.runtime || {};

    if (mutation?.currentModule) {
      runtime.currentModule = mutation.currentModule;
    }
    if (typeof mutation?.currentQuestionIndex === 'number') {
      runtime.currentQuestionIndex = mutation.currentQuestionIndex;
    }
    if (mutation?.remainingSecondsByModule) {
      runtime.remainingSecondsByModule = {
        ...(runtime.remainingSecondsByModule || {}),
        ...mutation.remainingSecondsByModule
      };
    }
    if (mutation?.resumeToken) {
      runtime.resumeToken = mutation.resumeToken;
    }

    runtime.lastHeartbeatAt = new Date();

    if (options?.interrupted) {
      runtime.interruptedAt = new Date();
      if (!runtime.resumeToken) {
        runtime.resumeToken = `resume-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      }
    }

    if (options?.clearInterruption) {
      runtime.interruptedAt = undefined;
      runtime.resumeToken = mutation?.resumeToken || `resume-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    }

    session.runtime = runtime;
  }

  public async startExam(userId: string, track: 'academic' | 'general', headers: IRequestHeaders) {
    const logMessage = constructLogMessage(__filename, 'startExam', headers);

    const session = await FullExamSessionModel.create({
      userId,
      track,
      status: 'in_progress',
      sections: [
        { module: 'speaking', status: 'in_progress' },
        { module: 'writing', status: 'pending' },
        { module: 'reading', status: 'pending' },
        { module: 'listening', status: 'pending' }
      ],
      runtime: {
        currentModule: 'speaking',
        currentQuestionIndex: 0,
        remainingSecondsByModule: { ...DEFAULT_REMAINING_SECONDS },
        lastHeartbeatAt: new Date(),
        resumeToken: `resume-${Date.now()}-${Math.floor(Math.random() * 100000)}`
      }
    });

    this.log.info(`${logMessage} :: Started full exam ${session._id}`);

    return session;
  }

  public async submitSection(
    userId: string,
    examId: string,
    module: IELTSModule,
    attemptId: string,
    score: number | undefined,
    headers: IRequestHeaders
  ) {
    const logMessage = constructLogMessage(__filename, 'submitSection', headers);

    const session = await FullExamSessionModel.findOne({ _id: examId, userId });
    if (!session) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Full exam session not found');
    }

    const section = session.sections.find(item => item.module === module);
    if (!section) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, `Unknown module section ${module}`);
    }

    section.status = 'completed';
    section.attemptId = attemptId;
    section.submittedAt = new Date();
    if (typeof score === 'number') {
      section.score = Number(score.toFixed(1));
    }

    const nextModule = this.getNextPendingModule({
      sections: session.sections.map(item => ({
        module: item.module,
        status: item.module === module ? 'completed' : item.status
      }))
    });

    session.sections.forEach(item => {
      if (item.module === nextModule && item.status !== 'completed') {
        item.status = 'in_progress';
      }
      if (item.module !== nextModule && item.status === 'in_progress' && item.module !== module) {
        item.status = 'pending';
      }
    });

    if (session.runtime) {
      session.runtime.currentModule = nextModule;
      session.runtime.currentQuestionIndex = 0;
      session.runtime.lastHeartbeatAt = new Date();
      session.runtime.interruptedAt = undefined;
    }

    await session.save();

    this.log.info(`${logMessage} :: Submitted ${module} section for exam ${examId}`);
    return session;
  }

  public async completeExam(userId: string, examId: string, headers: IRequestHeaders) {
    const logMessage = constructLogMessage(__filename, 'completeExam', headers);

    const session = await FullExamSessionModel.findOne({ _id: examId, userId });
    if (!session) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Full exam session not found');
    }

    session.status = 'completed';
    session.completedAt = new Date();
    if (session.runtime) {
      session.runtime.currentModule = undefined;
      session.runtime.currentQuestionIndex = undefined;
      session.runtime.interruptedAt = undefined;
      session.runtime.lastHeartbeatAt = new Date();
    }

    const scoredSections = session.sections.filter(section => typeof section.score === 'number');
    if (scoredSections.length > 0) {
      const average = scoredSections.reduce((sum, section) => sum + (section.score || 0), 0) / scoredSections.length;
      session.overallBand = Number(average.toFixed(1));
    }

    await session.save();

    this.log.info(`${logMessage} :: Completed full exam ${examId}`);
    return session;
  }

  public async getResults(userId: string, examId: string) {
    const session = await FullExamSessionModel.findOne({ _id: examId, userId });
    if (!session) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Full exam session not found');
    }

    return session;
  }

  public async pauseExam(
    userId: string,
    examId: string,
    mutation: FullExamRuntimeMutationRequest | undefined,
    headers: IRequestHeaders
  ) {
    const logMessage = constructLogMessage(__filename, 'pauseExam', headers);
    const session = await FullExamSessionModel.findOne({ _id: examId, userId });

    if (!session) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Full exam session not found');
    }

    if (session.status !== 'in_progress') {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Only in-progress exams can be paused');
    }

    this.updateRuntimeFromMutation(session, mutation, { interrupted: true });
    await session.save();

    this.log.info(`${logMessage} :: Paused full exam ${examId}`);
    return session;
  }

  public async resumeExam(
    userId: string,
    examId: string,
    mutation: FullExamRuntimeMutationRequest | undefined,
    headers: IRequestHeaders
  ) {
    const logMessage = constructLogMessage(__filename, 'resumeExam', headers);
    const session = await FullExamSessionModel.findOne({ _id: examId, userId });

    if (!session) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Full exam session not found');
    }

    if (session.status !== 'in_progress') {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Only in-progress exams can be resumed');
    }

    this.updateRuntimeFromMutation(session, mutation, { clearInterruption: true });
    await session.save();

    this.log.info(`${logMessage} :: Resumed full exam ${examId}`);
    return session;
  }

  public async getRuntime(userId: string, examId: string) {
    const session = await FullExamSessionModel.findOne({ _id: examId, userId });
    if (!session) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Full exam session not found');
    }

    return {
      examId: session._id.toString(),
      status: session.status,
      currentModule: session.runtime?.currentModule,
      currentQuestionIndex: session.runtime?.currentQuestionIndex,
      remainingSecondsByModule: session.runtime?.remainingSecondsByModule,
      interruptedAt: session.runtime?.interruptedAt,
      lastHeartbeatAt: session.runtime?.lastHeartbeatAt,
      resumeToken: session.runtime?.resumeToken,
      sections: session.sections
    };
  }
}
