/**
 * Audio Storage Service
 * Handles audio file storage in Supabase Storage or S3 while persisting metadata in Supabase Postgres.
 */

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@env';
import { createSupabaseSignedUrl, deleteFromSupabaseStorage, uploadToSupabaseStorage } from '@lib/db/supabaseStorage';
import { deleteRowsByIds, loadTableRows, upsertRow } from '@lib/db/documentStore';
import { EXTRA_TABLES } from '@lib/db/tableMappings';
import { generateMongoStyleId } from '@lib/db/id';
import { Service } from 'typedi';
import { Logger } from '../../lib/logger';
import { AudioRecording, AudioRecordingModel, RecordingType, StorageProvider } from '../models/AudioRecording';

@Service()
export class AudioStorageService {
  private log = new Logger(__filename);
  private s3Client: S3Client | null = null;
  private readonly storageProvider: StorageProvider;

  constructor() {
    this.storageProvider = env.storage.provider === 's3' ? StorageProvider.S3 : StorageProvider.SUPABASE;

    if (this.storageProvider === StorageProvider.S3) {
      this.initializeS3();
    }

    this.log.info(`Audio Storage initialized with provider: ${this.storageProvider}`);
  }

  private initializeS3(): void {
    if (!env.storage.s3.accessKeyId || !env.storage.s3.secretAccessKey) {
      this.log.warn('S3 credentials not configured, S3 provider will fail');
      return;
    }

    this.s3Client = new S3Client({
      region: env.storage.s3.region,
      credentials: {
        accessKeyId: env.storage.s3.accessKeyId,
        secretAccessKey: env.storage.s3.secretAccessKey
      }
    });
  }

  private async listRows(): Promise<AudioRecording[]> {
    const rows = await loadTableRows(EXTRA_TABLES.audioRecordings);
    return rows.map(row => ({
      _id: row.id,
      ...(row.data as AudioRecording)
    }));
  }

  private async getRecording(recordingId: string): Promise<AudioRecording> {
    const rows = await this.listRows();
    const recording = rows.find(candidate => candidate._id === recordingId);

    if (!recording) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    return recording;
  }

  async uploadAudio(params: {
    userId: string;
    sessionId: string;
    audioBuffer: Buffer;
    fileName: string;
    mimeType: string;
    recordingType: RecordingType;
    durationSeconds: number;
    topic?: string;
    testPart?: string;
    overallBand?: number;
    scores?: AudioRecording['scores'];
    userTier?: 'free' | 'premium' | 'pro';
  }): Promise<AudioRecording> {
    const fileSizeMB = params.audioBuffer.length / (1024 * 1024);
    if (fileSizeMB > env.storage.maxFileSizeMB) {
      throw new Error(`File size ${fileSizeMB.toFixed(2)}MB exceeds maximum ${env.storage.maxFileSizeMB}MB`);
    }

    if (!env.storage.allowedMimeTypes.includes(params.mimeType)) {
      throw new Error(`MIME type ${params.mimeType} not allowed`);
    }

    const recording: AudioRecording = AudioRecordingModel.create({
      _id: generateMongoStyleId(),
      userId: params.userId,
      sessionId: params.sessionId,
      recordingType: params.recordingType,
      fileName: params.fileName,
      mimeType: params.mimeType,
      fileSizeBytes: params.audioBuffer.length,
      durationSeconds: params.durationSeconds,
      storageProvider: this.storageProvider,
      topic: params.topic,
      testPart: params.testPart,
      overallBand: params.overallBand,
      scores: params.scores,
      expiresAt: AudioRecordingModel.calculateExpiryDate(params.userTier || 'free')
    });

    const storagePath = `audio-recordings/${recording.userId}/${recording.sessionId}/${recording._id}/${recording.fileName}`;

    if (this.storageProvider === StorageProvider.S3) {
      if (!this.s3Client) {
        throw new Error('S3 client not initialized');
      }

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: env.storage.s3.bucket,
          Key: storagePath,
          Body: params.audioBuffer,
          ContentType: recording.mimeType,
          Metadata: {
            userId: recording.userId,
            sessionId: recording.sessionId,
            recordingType: recording.recordingType
          }
        })
      );

      recording.s3Bucket = env.storage.s3.bucket;
      recording.s3Key = storagePath;
    } else {
      await uploadToSupabaseStorage(env.storage.supabase.audioBucket, storagePath, params.audioBuffer, recording.mimeType);
      recording.metadata = {
        ...(recording.metadata || {}),
        bucket: env.storage.supabase.audioBucket,
        objectPath: storagePath
      };
    }

    await upsertRow(EXTRA_TABLES.audioRecordings, recording._id!, {
      ...recording,
      createdAt: (recording.createdAt || new Date()).toISOString(),
      expiresAt: recording.expiresAt ? new Date(recording.expiresAt).toISOString() : undefined
    });

    return recording;
  }

  async getAudio(recordingId: string): Promise<{ url?: string; buffer?: Buffer; mimeType: string }> {
    const recording = await this.getRecording(recordingId);

    if (recording.storageProvider === StorageProvider.S3) {
      if (!recording.s3Key || !recording.s3Bucket || !this.s3Client) {
        throw new Error('S3 storage metadata missing');
      }

      const signedUrl = await getSignedUrl(
        this.s3Client,
        new GetObjectCommand({
          Bucket: recording.s3Bucket,
          Key: recording.s3Key
        }),
        { expiresIn: env.storage.s3.signedUrlExpiry }
      );

      return {
        url: signedUrl,
        mimeType: recording.mimeType
      };
    }

    const bucket = recording.metadata?.bucket || env.storage.supabase.audioBucket;
    const objectPath = recording.metadata?.objectPath;
    if (!objectPath) {
      throw new Error('Supabase object path missing for recording');
    }

    const signedUrl = await createSupabaseSignedUrl(bucket, objectPath);
    return {
      url: signedUrl,
      mimeType: recording.mimeType
    };
  }

  async listUserRecordings(
    userId: string,
    options?: {
      limit?: number;
      skip?: number;
      recordingType?: RecordingType;
    }
  ): Promise<{ recordings: AudioRecording[]; total: number }> {
    const all = await this.listRows();

    const filtered = all.filter(recording => {
      if (recording.userId !== userId) return false;
      if (options?.recordingType && recording.recordingType !== options.recordingType) return false;
      return true;
    });

    filtered.sort((a, b) => {
      const aDate = new Date(a.createdAt || 0).getTime();
      const bDate = new Date(b.createdAt || 0).getTime();
      return bDate - aDate;
    });

    const skip = options?.skip || 0;
    const limit = options?.limit || 50;
    const paginated = filtered.slice(skip, skip + limit);

    return {
      recordings: paginated,
      total: filtered.length
    };
  }

  async deleteRecording(recordingId: string): Promise<void> {
    const recording = await this.getRecording(recordingId);

    if (recording.storageProvider === StorageProvider.S3) {
      if (!this.s3Client || !recording.s3Bucket || !recording.s3Key) {
        throw new Error('S3 storage metadata missing');
      }

      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: recording.s3Bucket,
          Key: recording.s3Key
        })
      );
    } else {
      const bucket = recording.metadata?.bucket || env.storage.supabase.audioBucket;
      const objectPath = recording.metadata?.objectPath;
      if (objectPath) {
        await deleteFromSupabaseStorage(bucket, objectPath);
      }
    }

    await deleteRowsByIds(EXTRA_TABLES.audioRecordings, [recordingId]);
  }

  async cleanupExpiredRecordings(): Promise<number> {
    const rows = await this.listRows();
    const now = Date.now();
    const expired = rows.filter(recording => recording.expiresAt && new Date(recording.expiresAt).getTime() <= now);

    let deletedCount = 0;
    for (const recording of expired) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await this.deleteRecording(recording._id!);
        deletedCount += 1;
      } catch (error) {
        this.log.error(`Failed to delete expired recording ${recording._id}:`, error);
      }
    }

    return deletedCount;
  }

  async getStorageStats(userId: string): Promise<{
    totalRecordings: number;
    totalSizeMB: number;
    practiceCount: number;
    simulationCount: number;
    oldestRecording?: Date;
    newestRecording?: Date;
  }> {
    const rows = await this.listRows();
    const recordings = rows.filter(recording => recording.userId === userId);

    const totalSizeBytes = recordings.reduce((sum, item) => sum + (item.fileSizeBytes || 0), 0);
    const practiceCount = recordings.filter(item => item.recordingType === RecordingType.PRACTICE).length;
    const simulationCount = recordings.filter(item => item.recordingType === RecordingType.SIMULATION).length;

    const dates = recordings
      .map(item => new Date(item.createdAt))
      .filter(date => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    return {
      totalRecordings: recordings.length,
      totalSizeMB: totalSizeBytes / (1024 * 1024),
      practiceCount,
      simulationCount,
      oldestRecording: dates[0],
      newestRecording: dates[dates.length - 1]
    };
  }
}
