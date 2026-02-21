/**
 * Audio Storage Controller
 * Handles audio recording upload, retrieval, and management
 */

import type { Response } from 'express';
import {
  Delete,
  Get,
  HeaderParam,
  JsonController,
  Param,
  Post,
  QueryParam,
  Req,
  Res,
  UploadedFile
} from 'routing-controllers';
import { Service } from 'typedi';
import { Logger } from '../../lib/logger';
import { RecordingType } from '../models/AudioRecording';
import { AudioStorageService } from '../services/AudioStorageService';

@Service()
@JsonController('/audio')
export class AudioController {
  private log = new Logger(__filename);

  constructor(private audioStorageService: AudioStorageService) {}

  /**
   * Upload audio recording
   * POST /api/v1/audio/upload
   */
  @Post('/upload')
  async uploadAudio(@Req() req: any, @UploadedFile('audio') file: Express.Multer.File): Promise<any> {
    try {
      this.log.info('📤 Upload audio request received');

      if (!file) {
        return {
          success: false,
          error: 'No audio file provided'
        };
      }

      const {
        userId,
        sessionId,
        recordingType,
        durationSeconds,
        topic,
        testPart,
        overallBand,
        fluencyCoherence,
        lexicalResource,
        grammaticalRange,
        pronunciation,
        userTier
      } = req.body;

      if (!userId || !sessionId) {
        return {
          success: false,
          error: 'userId and sessionId are required'
        };
      }

      // Prepare scores if provided
      const scores =
        fluencyCoherence || lexicalResource || grammaticalRange || pronunciation
          ? {
              fluencyCoherence: parseFloat(fluencyCoherence),
              lexicalResource: parseFloat(lexicalResource),
              grammaticalRange: parseFloat(grammaticalRange),
              pronunciation: parseFloat(pronunciation)
            }
          : undefined;

      const recording = await this.audioStorageService.uploadAudio({
        userId,
        sessionId,
        audioBuffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
        recordingType: (recordingType as RecordingType) || RecordingType.PRACTICE,
        durationSeconds: parseFloat(durationSeconds) || 0,
        topic,
        testPart,
        overallBand: overallBand ? parseFloat(overallBand) : undefined,
        scores,
        userTier: userTier || 'free'
      });

      return {
        success: true,
        data: {
          recordingId: recording._id,
          fileName: recording.fileName,
          fileSizeBytes: recording.fileSizeBytes,
          durationSeconds: recording.durationSeconds,
          storageProvider: recording.storageProvider,
          createdAt: recording.createdAt,
          expiresAt: recording.expiresAt
        }
      };
    } catch (error: any) {
      this.log.error('❌ Upload audio error:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload audio'
      };
    }
  }

  /**
   * Get audio recording (download or signed URL)
   * GET /api/v1/audio/:recordingId
   */
  @Get('/:recordingId')
  async getAudio(@Param('recordingId') recordingId: string, @Res() res: Response): Promise<any> {
    try {
      this.log.info(`📥 Get audio request: ${recordingId}`);

      const result = await this.audioStorageService.getAudio(recordingId);

      if (result.url) {
        // S3 signed URL - redirect
        return res.redirect(result.url);
      } else if (result.buffer) {
        // MongoDB buffer - stream
        res.setHeader('Content-Type', result.mimeType);
        res.setHeader('Content-Length', result.buffer.length);
        return res.send(result.buffer);
      } else {
        return res.status(404).json({
          success: false,
          error: 'Audio not found'
        });
      }
    } catch (error: any) {
      this.log.error('❌ Get audio error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to retrieve audio'
      });
    }
  }

  /**
   * List user recordings
   * GET /api/v1/audio/list/:userId
   */
  @Get('/list/:userId')
  async listRecordings(
    @Param('userId') userId: string,
    @QueryParam('limit') limit?: number,
    @QueryParam('skip') skip?: number,
    @QueryParam('recordingType') recordingType?: RecordingType
  ): Promise<any> {
    try {
      this.log.info(`📋 List recordings for user: ${userId}`);

      const result = await this.audioStorageService.listUserRecordings(userId, {
        limit: limit || 50,
        skip: skip || 0,
        recordingType
      });

      return {
        success: true,
        data: {
          recordings: result.recordings.map(r => ({
            id: r._id,
            sessionId: r.sessionId,
            recordingType: r.recordingType,
            fileName: r.fileName,
            fileSizeBytes: r.fileSizeBytes,
            durationSeconds: r.durationSeconds,
            topic: r.topic,
            testPart: r.testPart,
            overallBand: r.overallBand,
            scores: r.scores,
            createdAt: r.createdAt,
            expiresAt: r.expiresAt
          })),
          total: result.total,
          limit: limit || 50,
          skip: skip || 0
        }
      };
    } catch (error: any) {
      this.log.error('❌ List recordings error:', error);
      return {
        success: false,
        error: error.message || 'Failed to list recordings'
      };
    }
  }

  /**
   * Delete recording
   * DELETE /api/v1/audio/:recordingId
   */
  @Delete('/:recordingId')
  async deleteRecording(
    @Param('recordingId') recordingId: string,
    @HeaderParam('x-user-id') userId?: string
  ): Promise<any> {
    try {
      const requester = userId ?? 'unknown';
      this.log.info(`🗑️  Delete recording request: ${recordingId} by ${requester}`);

      // TODO: Add authorization check - verify userId owns this recording

      await this.audioStorageService.deleteRecording(recordingId);

      return {
        success: true,
        message: 'Recording deleted successfully'
      };
    } catch (error: any) {
      this.log.error('❌ Delete recording error:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete recording'
      };
    }
  }

  /**
   * Get storage statistics
   * GET /api/v1/audio/stats/:userId
   */
  @Get('/stats/:userId')
  async getStorageStats(@Param('userId') userId: string): Promise<any> {
    try {
      this.log.info(`📊 Get storage stats for user: ${userId}`);

      const stats = await this.audioStorageService.getStorageStats(userId);

      return {
        success: true,
        data: stats
      };
    } catch (error: any) {
      this.log.error('❌ Get storage stats error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get storage stats'
      };
    }
  }

  /**
   * Cleanup expired recordings (admin/cron)
   * POST /api/v1/audio/cleanup
   */
  @Post('/cleanup')
  async cleanupExpired(@HeaderParam('x-admin-key') adminKey?: string): Promise<any> {
    try {
      // TODO: Add admin authentication
      if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
        return {
          success: false,
          error: 'Unauthorized'
        };
      }

      this.log.info('🧹 Starting expired recordings cleanup');

      const deletedCount = await this.audioStorageService.cleanupExpiredRecordings();

      return {
        success: true,
        data: {
          deletedCount,
          message: `Deleted ${deletedCount} expired recordings`
        }
      };
    } catch (error: any) {
      this.log.error('❌ Cleanup error:', error);
      return {
        success: false,
        error: error.message || 'Failed to cleanup recordings'
      };
    }
  }
}
