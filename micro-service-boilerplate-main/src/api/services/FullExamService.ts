import { Service } from 'typedi';

import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { FullExamSessionModel, IELTSModule } from '@models/FullExamSessionModel';

@Service()
export class FullExamService {
  private readonly log = new Logger(__filename);

  public async startExam(userId: string, track: 'academic' | 'general', headers: IRequestHeaders) {
    const logMessage = constructLogMessage(__filename, 'startExam', headers);

    const session = await FullExamSessionModel.create({
      userId,
      track,
      status: 'in_progress',
      sections: [
        { module: 'speaking', status: 'pending' },
        { module: 'writing', status: 'pending' },
        { module: 'reading', status: 'pending' },
        { module: 'listening', status: 'pending' }
      ]
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
}
