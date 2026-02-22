import { Service } from 'typedi';

import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { UserModel } from '@models/UserModel';
import { WritingSubmissionModel } from '@models/WritingSubmissionModel';
import { WritingTaskModel } from '@models/WritingTaskModel';

import { AIOrchestrationService } from './AIOrchestrationService';
import { UsageService } from './UsageService';

@Service()
export class WritingService {
  private readonly log = new Logger(__filename);

  constructor(
    private readonly aiOrchestrationService: AIOrchestrationService,
    private readonly usageService: UsageService
  ) {}

  public async generateTask(
    userId: string,
    input: { track: 'academic' | 'general'; taskType: 'task1' | 'task2' },
    headers: IRequestHeaders
  ) {
    const logMessage = constructLogMessage(__filename, 'generateTask', headers);

    let task = await WritingTaskModel.findOne({
      track: input.track,
      taskType: input.taskType,
      active: true,
      autoPublished: true
    }).sort({ updatedAt: -1 });

    if (!task) {
      const generated = await this.aiOrchestrationService.generateModuleTask(
        {
          module: 'writing',
          track: input.track,
          hints: [input.taskType]
        },
        { userId, plan: await this.getUserPlan(userId) }
      );

      task = await WritingTaskModel.create({
        track: input.track,
        taskType: generated.taskType || input.taskType,
        title: generated.title,
        prompt: generated.prompt,
        instructions: generated.instructions || [],
        suggestedTimeMinutes: generated.suggestedTimeMinutes || 40,
        minimumWords: generated.minimumWords || (generated.taskType === 'task2' ? 250 : 150),
        tags: generated.tags || [],
        source: 'ai',
        autoPublished: true,
        active: true
      });
    }

    this.log.info(`${logMessage} :: Generated writing task ${task._id}`);

    return {
      taskId: task._id,
      track: task.track,
      taskType: task.taskType,
      title: task.title,
      prompt: task.prompt,
      instructions: task.instructions,
      suggestedTimeMinutes: task.suggestedTimeMinutes,
      minimumWords: task.minimumWords,
      tags: task.tags
    };
  }

  public async submitWriting(
    userId: string,
    taskId: string,
    responseText: string,
    durationSeconds: number,
    headers: IRequestHeaders
  ) {
    const logMessage = constructLogMessage(__filename, 'submitWriting', headers);
    const plan = await this.getUserPlan(userId);

    await this.usageService.assertModuleAllowance(userId, plan, 'writing', headers);

    const task = await WritingTaskModel.findById(taskId);
    if (!task) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Writing task not found');
    }

    const evaluation = await this.aiOrchestrationService.evaluateWriting(
      {
        prompt: task.prompt,
        responseText,
        taskType: task.taskType,
        track: task.track
      },
      { userId, plan }
    );

    const wordCount = responseText.trim().split(/\s+/).filter(Boolean).length;

    const submission = await WritingSubmissionModel.create({
      userId,
      taskId,
      track: task.track,
      taskType: task.taskType,
      responseText,
      wordCount,
      durationSeconds: Math.max(0, Math.round(durationSeconds || 0)),
      overallBand: evaluation.overallBand,
      breakdown: evaluation.breakdown,
      feedback: evaluation.feedback,
      model: evaluation.model,
      status: 'evaluated'
    });

    await this.usageService.incrementModuleUsage(userId, 'writing');

    this.log.info(`${logMessage} :: Writing submission evaluated ${submission._id}`);

    return submission;
  }

  public async getSubmission(userId: string, submissionId: string) {
    const submission = await WritingSubmissionModel.findOne({
      _id: submissionId,
      userId
    }).populate('taskId');

    if (!submission) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Writing submission not found');
    }

    return submission;
  }

  public async getHistory(userId: string, limit: number, offset: number) {
    return WritingSubmissionModel.find({ userId }).sort({ createdAt: -1 }).skip(offset).limit(limit);
  }

  private async getUserPlan(userId: string) {
    const user = await UserModel.findById(userId).select('subscriptionPlan');
    if (!user) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'User not found');
    }

    return user.subscriptionPlan;
  }
}
