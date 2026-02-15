/**
 * Audio Recording Model
 * Stores metadata and audio data for user practice/simulation sessions
 */

export enum RecordingType {
  PRACTICE = 'practice',
  SIMULATION = 'simulation'
}

export enum StorageProvider {
  SUPABASE = 'supabase',
  MONGODB = 'mongodb',
  S3 = 's3'
}

export interface AudioRecording {
  _id?: string;
  userId: string;
  sessionId: string;
  recordingType: RecordingType;

  // Audio metadata
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  durationSeconds: number;

  // Storage details
  storageProvider: StorageProvider;
  mongoData?: Buffer; // For MongoDB storage
  s3Key?: string; // For S3 storage
  s3Bucket?: string;

  // Session context
  topic?: string;
  testPart?: string; // 'part1', 'part2', 'part3'
  overallBand?: number;

  // Evaluation scores
  scores?: {
    fluencyCoherence?: number;
    lexicalResource?: number;
    grammaticalRange?: number;
    pronunciation?: number;
  };

  // Timestamps
  createdAt: Date;
  expiresAt?: Date; // For automatic cleanup

  // Metadata
  metadata?: Record<string, any>;
}

export class AudioRecordingModel {
  static collectionName = 'audio_recordings';

  /**
   * Create recording document structure
   */
  static create(data: Partial<AudioRecording>): AudioRecording {
    return {
      userId: data.userId!,
      sessionId: data.sessionId!,
      recordingType: data.recordingType || RecordingType.PRACTICE,
      fileName: data.fileName!,
      mimeType: data.mimeType!,
      fileSizeBytes: data.fileSizeBytes || 0,
      durationSeconds: data.durationSeconds || 0,
      storageProvider: data.storageProvider || StorageProvider.SUPABASE,
      mongoData: data.mongoData,
      s3Key: data.s3Key,
      s3Bucket: data.s3Bucket,
      topic: data.topic,
      testPart: data.testPart,
      overallBand: data.overallBand,
      scores: data.scores,
      createdAt: data.createdAt || new Date(),
      expiresAt: data.expiresAt,
      metadata: data.metadata || {}
    };
  }

  /**
   * Generate S3 key path
   */
  static generateS3Key(userId: string, sessionId: string, fileName: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `recordings/${userId}/${year}/${month}/${sessionId}/${fileName}`;
  }

  /**
   * Calculate expiration date based on tier
   */
  static calculateExpiryDate(tier: 'free' | 'premium' | 'pro'): Date | undefined {
    const now = new Date();

    // Free: 30 days, Premium: 1 year, Pro: never expires
    if (tier === 'free') {
      now.setDate(now.getDate() + 30);
      return now;
    } else if (tier === 'premium') {
      now.setFullYear(now.getFullYear() + 1);
      return now;
    }

    // Pro users: no expiry
    return undefined;
  }
}
