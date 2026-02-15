/**
 * Audio Storage Service (Supabase Storage + Postgres)
 *
 * Replaces MongoDB GridFS/S3 implementations. Audio blobs are stored in the
 * private `audio` bucket; metadata is stored in `public.audio_recordings`.
 */

import { getSupabaseAdmin } from '@lib/supabaseClient';
import { randomUUID } from 'crypto';
import { Service } from 'typedi';

import { env } from '@env';
import { Logger } from '@lib/logger';
import { AudioRecording, AudioRecordingModel, RecordingType, StorageProvider } from '@models/AudioRecording';

type AudioRecordingRow = {
  id: string;
  user_id: string;
  session_id: string;
  recording_type: 'practice' | 'simulation';
  bucket: string;
  object_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  duration_seconds: number;
  topic: string | null;
  test_part: string | null;
  overall_band: number | null;
  scores: any | null;
  storage_provider: string;
  expires_at: string | null;
  created_at: string;
};

function inferExt(fileName: string, mimeType: string): string {
  const lower = fileName.toLowerCase();
  const idx = lower.lastIndexOf('.');
  if (idx > -1 && idx < lower.length - 1) {
    const ext = lower.slice(idx + 1);
    if (ext.length <= 6) return ext;
  }

  const map: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/m4a': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/wav': 'wav',
    'audio/wave': 'wav',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac',
    'audio/aac': 'aac',
    'audio/3gpp': '3gp'
  };

  return map[mimeType] || 'm4a';
}

function toAudioRecording(row: AudioRecordingRow): AudioRecording {
  return {
    _id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    recordingType: row.recording_type === 'simulation' ? RecordingType.SIMULATION : RecordingType.PRACTICE,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSizeBytes: Number(row.file_size_bytes || 0),
    durationSeconds: Number(row.duration_seconds || 0),
    storageProvider: StorageProvider.SUPABASE,
    topic: row.topic || undefined,
    testPart: row.test_part || undefined,
    overallBand: row.overall_band == null ? undefined : Number(row.overall_band),
    scores: row.scores || undefined,
    createdAt: new Date(row.created_at),
    expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    metadata: {
      bucket: row.bucket,
      objectPath: row.object_path
    }
  };
}

@Service()
export class AudioStorageService {
  private log = new Logger(__filename);
  private readonly bucket = 'audio';

  /**
   * Upload audio file (stores blob in Storage + row in Postgres).
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

    const fileSizeMB = params.audioBuffer.length / (1024 * 1024);
    if (fileSizeMB > env.storage.maxFileSizeMB) {
      throw new Error(`File size ${fileSizeMB.toFixed(2)}MB exceeds maximum ${env.storage.maxFileSizeMB}MB`);
    }

    if (!env.storage.allowedMimeTypes.includes(params.mimeType)) {
      throw new Error(`MIME type ${params.mimeType} not allowed`);
    }

    const supabase = getSupabaseAdmin();
    const ext = inferExt(params.fileName, params.mimeType);
    const objectPath = `recordings/${params.userId}/${params.sessionId}/${Date.now()}-${randomUUID()}.${ext}`;

    const uploadResult = await supabase.storage.from(this.bucket).upload(objectPath, params.audioBuffer as any, {
      contentType: params.mimeType,
      upsert: false
    });

    if (uploadResult.error) {
      this.log.error('❌ Supabase Storage upload failed', { error: uploadResult.error.message });
      throw new Error('Failed to upload audio');
    }

    const expiresAt = AudioRecordingModel.calculateExpiryDate(params.userTier || 'free');

    const { data: inserted, error: insertError } = await supabase
      .from('audio_recordings')
      .insert({
        user_id: params.userId,
        session_id: params.sessionId,
        recording_type: params.recordingType,
        bucket: this.bucket,
        object_path: objectPath,
        file_name: params.fileName,
        mime_type: params.mimeType,
        file_size_bytes: params.audioBuffer.length,
        duration_seconds: Math.max(0, Math.round(params.durationSeconds || 0)),
        topic: params.topic || null,
        test_part: params.testPart || null,
        overall_band: params.overallBand ?? null,
        scores: params.scores ?? null,
        storage_provider: StorageProvider.SUPABASE,
        expires_at: expiresAt ? expiresAt.toISOString() : null
      })
      .select(
        'id, user_id, session_id, recording_type, bucket, object_path, file_name, mime_type, file_size_bytes, duration_seconds, topic, test_part, overall_band, scores, storage_provider, expires_at, created_at'
      )
      .single();

    if (insertError || !inserted) {
      // Try to remove the blob to avoid orphaned files.
      await supabase.storage.from(this.bucket).remove([objectPath]);
      this.log.error('❌ Failed to persist audio metadata', { error: insertError?.message || insertError });
      throw new Error('Failed to save audio metadata');
    }

    this.log.info(`✅ Audio uploaded successfully: ${inserted.id}`);
    return toAudioRecording(inserted as AudioRecordingRow);
  }

  /**
   * Get audio as a signed URL (preferred for mobile playback).
   */
  async getAudio(recordingId: string, userId?: string): Promise<{ url?: string; buffer?: Buffer; mimeType: string }> {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('audio_recordings')
      .select(
        'id, user_id, session_id, recording_type, bucket, object_path, file_name, mime_type, file_size_bytes, duration_seconds, topic, test_part, overall_band, scores, storage_provider, expires_at, created_at'
      )
      .eq('id', recordingId);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) {
      throw new Error('Recording not found');
    }

    const row = data as AudioRecordingRow;
    const { data: signed, error: signedError } = await supabase.storage.from(row.bucket).createSignedUrl(row.object_path, 60 * 15);
    if (signedError || !signed?.signedUrl) {
      this.log.error('Failed to create signed URL', { error: signedError?.message || signedError, recordingId });
      throw new Error('Failed to retrieve audio');
    }

    return { url: signed.signedUrl, mimeType: row.mime_type };
  }

  /**
   * List user recordings (metadata only).
   */
  async listUserRecordings(
    userId: string,
    options?: {
      limit?: number;
      skip?: number;
      recordingType?: RecordingType;
    }
  ): Promise<{ recordings: AudioRecording[]; total: number }> {
    const supabase = getSupabaseAdmin();
    const limit = typeof options?.limit === 'number' && options.limit > 0 ? Math.min(options.limit, 100) : 50;
    const skip = typeof options?.skip === 'number' && options.skip >= 0 ? options.skip : 0;

    let query = supabase
      .from('audio_recordings')
      .select(
        'id, user_id, session_id, recording_type, bucket, object_path, file_name, mime_type, file_size_bytes, duration_seconds, topic, test_part, overall_band, scores, storage_provider, expires_at, created_at',
        { count: 'exact' }
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.recordingType) {
      query = query.eq('recording_type', options.recordingType);
    }

    const { data, error, count } = await query.range(skip, skip + limit - 1);
    if (error) {
      this.log.error('Failed to list recordings', { userId, error: error.message });
      throw new Error('Failed to list recordings');
    }

    return {
      recordings: ((data || []) as AudioRecordingRow[]).map(row => toAudioRecording(row)),
      total: typeof count === 'number' ? count : (data || []).length
    };
  }

  /**
   * Delete recording (removes blob + metadata).
   */
  async deleteRecording(recordingId: string, userId?: string): Promise<void> {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('audio_recordings')
      .select('id, user_id, bucket, object_path')
      .eq('id', recordingId);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) {
      throw new Error('Recording not found');
    }

    const row = data as { id: string; user_id: string; bucket: string; object_path: string };

    // Best-effort remove object.
    const removeResult = await supabase.storage.from(row.bucket).remove([row.object_path]);
    if (removeResult.error) {
      this.log.warn('Failed to remove audio object (continuing)', {
        recordingId,
        error: removeResult.error.message
      });
    }

    await supabase.from('audio_recordings').delete().eq('id', recordingId);
    this.log.info(`🗑️  Deleted recording: ${recordingId}`);
  }

  /**
   * Cleanup expired recordings (admin/cron).
   */
  async cleanupExpiredRecordings(): Promise<number> {
    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from('audio_recordings')
      .select('id, bucket, object_path')
      .not('expires_at', 'is', null)
      .lte('expires_at', nowIso)
      .limit(250);

    if (error) {
      this.log.error('Failed to query expired recordings', { error: error.message });
      return 0;
    }

    const rows = (data || []) as Array<{ id: string; bucket: string; object_path: string }>;
    if (!rows.length) return 0;

    // Remove blobs in batches (Supabase Storage remove supports up to 1000 items).
    const byBucket = new Map<string, string[]>();
    rows.forEach(r => {
      byBucket.set(r.bucket, [...(byBucket.get(r.bucket) || []), r.object_path]);
    });

    for (const [bucket, paths] of byBucket.entries()) {
      const removeResult = await supabase.storage.from(bucket).remove(paths);
      if (removeResult.error) {
        this.log.warn('Failed to remove some expired audio objects', { bucket, error: removeResult.error.message });
      }
    }

    await supabase.from('audio_recordings').delete().in(
      'id',
      rows.map(r => r.id)
    );

    this.log.info(`🧹 Cleanup completed: ${rows.length} expired recordings deleted`);
    return rows.length;
  }

  /**
   * Get storage statistics (simple aggregate computed in JS).
   */
  async getStorageStats(userId: string): Promise<{
    totalRecordings: number;
    totalSizeMB: number;
    practiceCount: number;
    simulationCount: number;
    oldestRecording?: Date;
    newestRecording?: Date;
  }> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('audio_recordings')
      .select('file_size_bytes, recording_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      this.log.error('Failed to load storage stats', { userId, error: error.message });
      throw new Error('Failed to load storage stats');
    }

    const rows = (data || []) as Array<{ file_size_bytes: number; recording_type: string; created_at: string }>;
    const totalRecordings = rows.length;
    const totalSizeBytes = rows.reduce((sum, r) => sum + Number(r.file_size_bytes || 0), 0);
    const practiceCount = rows.filter(r => r.recording_type === 'practice').length;
    const simulationCount = rows.filter(r => r.recording_type === 'simulation').length;

    return {
      totalRecordings,
      totalSizeMB: totalSizeBytes / (1024 * 1024),
      practiceCount,
      simulationCount,
      oldestRecording: rows[0] ? new Date(rows[0].created_at) : undefined,
      newestRecording: rows[rows.length - 1] ? new Date(rows[rows.length - 1].created_at) : undefined
    };
  }
}

