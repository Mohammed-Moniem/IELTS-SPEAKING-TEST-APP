/**
 * Audio Storage Service
 * Handles audio file storage in MongoDB or S3 based on configuration
 */

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Db, GridFSBucket, MongoClient, ObjectId } from 'mongodb';
import { Readable } from 'stream';
import { Service } from 'typedi';
import { env } from '../../env';
import { Logger } from '../../lib/logger';
import { AudioRecording, AudioRecordingModel, RecordingType, StorageProvider } from '../models/AudioRecording';

@Service()
export class AudioStorageService {
  private log = new Logger(__filename);
  private db: Db;
  private gridFSBucket: GridFSBucket;
  private s3Client: S3Client;
  private readonly storageProvider: StorageProvider;

  constructor() {
    this.storageProvider = env.storage.provider === 's3' ? StorageProvider.S3 : StorageProvider.MONGODB;
    this.log.info(`📦 Audio Storage initialized with provider: ${this.storageProvider}`);

    if (this.storageProvider === StorageProvider.S3) {
      this.initializeS3();
    }
  }

  /**
   * Initialize MongoDB GridFS connection
   */
  async initializeMongoDB(): Promise<void> {
    try {
      const client = await MongoClient.connect(env.db.mongoURL);
      this.db = client.db();
      this.gridFSBucket = new GridFSBucket(this.db, {
        bucketName: env.storage.mongodb.audioCollectionName
      });
      this.log.info('✅ MongoDB GridFS initialized');
    } catch (error) {
      this.log.error('❌ Failed to initialize MongoDB GridFS:', error);
      throw error;
    }
  }

  /**
   * Initialize AWS S3 client
   */
  private initializeS3(): void {
    if (!env.storage.s3.accessKeyId || !env.storage.s3.secretAccessKey) {
      this.log.warn('⚠️  S3 credentials not configured, falling back to MongoDB');
      return;
    }

    this.s3Client = new S3Client({
      region: env.storage.s3.region,
      credentials: {
        accessKeyId: env.storage.s3.accessKeyId,
        secretAccessKey: env.storage.s3.secretAccessKey
      }
    });
    this.log.info('✅ AWS S3 client initialized');
  }

  /**
   * Upload audio file
   */
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
    this.log.info(`📤 Uploading audio for user ${params.userId}, session ${params.sessionId}`);

    // Validate file size
    const fileSizeMB = params.audioBuffer.length / (1024 * 1024);
    if (fileSizeMB > env.storage.maxFileSizeMB) {
      throw new Error(`File size ${fileSizeMB.toFixed(2)}MB exceeds maximum ${env.storage.maxFileSizeMB}MB`);
    }

    // Validate MIME type
    if (!env.storage.allowedMimeTypes.includes(params.mimeType)) {
      throw new Error(`MIME type ${params.mimeType} not allowed. Allowed: ${env.storage.allowedMimeTypes.join(', ')}`);
    }

    const recording: AudioRecording = AudioRecordingModel.create({
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

    try {
      if (this.storageProvider === StorageProvider.MONGODB) {
        await this.uploadToMongoDB(recording, params.audioBuffer);
      } else {
        await this.uploadToS3(recording, params.audioBuffer);
      }

      this.log.info(`✅ Audio uploaded successfully: ${recording._id}`);
      return recording;
    } catch (error) {
      this.log.error('❌ Failed to upload audio:', error);
      throw error;
    }
  }

  /**
   * Upload to MongoDB GridFS
   */
  private async uploadToMongoDB(recording: AudioRecording, audioBuffer: Buffer): Promise<void> {
    if (!this.db) {
      await this.initializeMongoDB();
    }

    const collection = this.db.collection<AudioRecording>(AudioRecordingModel.collectionName);

    // Store audio data directly in document (for small files) or use GridFS (for large files)
    if (audioBuffer.length < 16 * 1024 * 1024) {
      // < 16MB, store inline
      recording.mongoData = audioBuffer;
      const result = await collection.insertOne(recording as any);
      recording._id = result.insertedId.toString();
    } else {
      // Use GridFS for large files
      const uploadStream = this.gridFSBucket.openUploadStream(recording.fileName, {
        metadata: {
          userId: recording.userId,
          sessionId: recording.sessionId,
          mimeType: recording.mimeType
        }
      });

      const readable = Readable.from(audioBuffer);
      await new Promise((resolve, reject) => {
        readable.pipe(uploadStream).on('finish', resolve).on('error', reject);
      });

      recording.mongoData = undefined;
      recording.metadata = { gridFSFileId: uploadStream.id.toString() };

      const result = await collection.insertOne(recording as any);
      recording._id = result.insertedId.toString();
    }
  }

  /**
   * Upload to AWS S3
   */
  private async uploadToS3(recording: AudioRecording, audioBuffer: Buffer): Promise<void> {
    const s3Key = AudioRecordingModel.generateS3Key(recording.userId, recording.sessionId, recording.fileName);

    const command = new PutObjectCommand({
      Bucket: env.storage.s3.bucket,
      Key: s3Key,
      Body: audioBuffer,
      ContentType: recording.mimeType,
      Metadata: {
        userId: recording.userId,
        sessionId: recording.sessionId,
        recordingType: recording.recordingType,
        topic: recording.topic || '',
        overallBand: recording.overallBand?.toString() || ''
      }
    });

    await this.s3Client.send(command);

    recording.s3Key = s3Key;
    recording.s3Bucket = env.storage.s3.bucket;

    // Save metadata to MongoDB
    if (!this.db) {
      await this.initializeMongoDB();
    }
    const collection = this.db.collection<AudioRecording>(AudioRecordingModel.collectionName);
    const result = await collection.insertOne(recording as any);
    recording._id = result.insertedId.toString();
  }

  /**
   * Get audio download URL or buffer
   */
  async getAudio(recordingId: string): Promise<{ url?: string; buffer?: Buffer; mimeType: string }> {
    if (!this.db) {
      await this.initializeMongoDB();
    }

    const collection = this.db.collection<AudioRecording>(AudioRecordingModel.collectionName);
    const recording = await collection.findOne({ _id: new ObjectId(recordingId) as any });

    if (!recording) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    if (recording.storageProvider === StorageProvider.MONGODB) {
      return this.getFromMongoDB(recording);
    } else {
      return this.getFromS3(recording);
    }
  }

  /**
   * Get from MongoDB
   */
  private async getFromMongoDB(recording: AudioRecording): Promise<{ buffer: Buffer; mimeType: string }> {
    if (recording.mongoData) {
      // Data stored inline
      return { buffer: recording.mongoData, mimeType: recording.mimeType };
    } else if (recording.metadata?.gridFSFileId) {
      // Data in GridFS
      const downloadStream = this.gridFSBucket.openDownloadStream(new ObjectId(recording.metadata.gridFSFileId));
      const chunks: Buffer[] = [];

      await new Promise((resolve, reject) => {
        downloadStream
          .on('data', chunk => chunks.push(chunk))
          .on('end', resolve)
          .on('error', reject);
      });

      return { buffer: Buffer.concat(chunks), mimeType: recording.mimeType };
    } else {
      throw new Error('Audio data not found in MongoDB');
    }
  }

  /**
   * Get from S3 (signed URL)
   */
  private async getFromS3(recording: AudioRecording): Promise<{ url: string; mimeType: string }> {
    if (!recording.s3Key || !recording.s3Bucket) {
      throw new Error('S3 key not found for recording');
    }

    const command = new GetObjectCommand({
      Bucket: recording.s3Bucket,
      Key: recording.s3Key
    });

    const signedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: env.storage.s3.signedUrlExpiry
    });

    return { url: signedUrl, mimeType: recording.mimeType };
  }

  /**
   * List user recordings
   */
  async listUserRecordings(
    userId: string,
    options?: {
      limit?: number;
      skip?: number;
      recordingType?: RecordingType;
    }
  ): Promise<{ recordings: AudioRecording[]; total: number }> {
    if (!this.db) {
      await this.initializeMongoDB();
    }

    const collection = this.db.collection<AudioRecording>(AudioRecordingModel.collectionName);

    const query: any = { userId };
    if (options?.recordingType) {
      query.recordingType = options.recordingType;
    }

    const total = await collection.countDocuments(query);
    const recordings = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(options?.skip || 0)
      .limit(options?.limit || 50)
      .toArray();

    // Remove audio data from response (only return metadata)
    const sanitized = recordings.map(r => {
      const { mongoData, ...rest } = r;
      return rest;
    });

    return { recordings: sanitized as AudioRecording[], total };
  }

  /**
   * Delete recording
   */
  async deleteRecording(recordingId: string): Promise<void> {
    if (!this.db) {
      await this.initializeMongoDB();
    }

    const collection = this.db.collection<AudioRecording>(AudioRecordingModel.collectionName);
    const recording = await collection.findOne({ _id: new ObjectId(recordingId) as any });

    if (!recording) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    if (recording.storageProvider === StorageProvider.S3 && recording.s3Key) {
      // Delete from S3
      const command = new DeleteObjectCommand({
        Bucket: recording.s3Bucket,
        Key: recording.s3Key
      });
      await this.s3Client.send(command);
    } else if (recording.metadata?.gridFSFileId) {
      // Delete from GridFS
      await this.gridFSBucket.delete(new ObjectId(recording.metadata.gridFSFileId));
    }

    // Delete metadata
    await collection.deleteOne({ _id: new ObjectId(recordingId) as any });
    this.log.info(`🗑️  Deleted recording: ${recordingId}`);
  }

  /**
   * Cleanup expired recordings (cron job)
   */
  async cleanupExpiredRecordings(): Promise<number> {
    if (!this.db) {
      await this.initializeMongoDB();
    }

    const collection = this.db.collection<AudioRecording>(AudioRecordingModel.collectionName);
    const expiredRecordings = await collection.find({ expiresAt: { $lte: new Date() } }).toArray();

    let deletedCount = 0;
    for (const recording of expiredRecordings) {
      try {
        await this.deleteRecording(recording._id!.toString());
        deletedCount++;
      } catch (error) {
        this.log.error(`Failed to delete expired recording ${recording._id}:`, error);
      }
    }

    this.log.info(`🧹 Cleanup completed: ${deletedCount} expired recordings deleted`);
    return deletedCount;
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(userId: string): Promise<{
    totalRecordings: number;
    totalSizeMB: number;
    practiceCount: number;
    simulationCount: number;
    oldestRecording?: Date;
    newestRecording?: Date;
  }> {
    if (!this.db) {
      await this.initializeMongoDB();
    }

    const collection = this.db.collection<AudioRecording>(AudioRecordingModel.collectionName);

    const recordings = await collection.find({ userId }).toArray();

    const totalSizeBytes = recordings.reduce((sum, r) => sum + r.fileSizeBytes, 0);
    const practiceCount = recordings.filter(r => r.recordingType === RecordingType.PRACTICE).length;
    const simulationCount = recordings.filter(r => r.recordingType === RecordingType.SIMULATION).length;

    const dates = recordings.map(r => r.createdAt).sort((a, b) => a.getTime() - b.getTime());

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
