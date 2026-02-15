import { env } from '@env';
import { getSupabaseAdmin } from '@lib/supabaseClient';
import { Logger } from '../../lib/logger';
import path from 'path';
import { randomUUID } from 'crypto';

const log = new Logger(__filename);

export interface UploadedFile {
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  url: string;
  thumbnailUrl?: string;
  expiresAt: Date;
  bucket: string;
  objectPath: string;
}

export interface FileMetadata {
  userId: string;
  conversationId: string;
  messageType: 'image' | 'video' | 'audio' | 'file' | 'gif';
  duration?: number; // For audio/video in seconds
  width?: number; // For images/videos
  height?: number; // For images/videos
  waveformData?: number[]; // For audio visualization
}

const sanitizeFileName = (name: string): string => {
  const base = path.basename(name || 'file');
  return base.replace(/[^\w.\-()+ ]+/g, '_').slice(0, 180) || `file_${Date.now()}`;
};

/**
 * File Storage Service (Supabase Storage)
 *
 * Replaces MongoDB GridFS/S3 paths with private Supabase buckets.
 * The backend returns signed URLs for downloads.
 */
class FileStorageService {
  private readonly bucket = 'chat-files';

  getProvider(): 'supabase' {
    return 'supabase';
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    metadata: FileMetadata
  ): Promise<UploadedFile> {
    const fileSizeMB = fileBuffer.length / (1024 * 1024);
    if (fileSizeMB > env.storage.maxFileSizeMB) {
      throw new Error(`File size exceeds maximum allowed size of ${env.storage.maxFileSizeMB}MB`);
    }

    if (!env.storage.allowedMimeTypes.includes(mimeType)) {
      throw new Error(`File type ${mimeType} is not allowed`);
    }

    const supabase = getSupabaseAdmin();
    const safeName = sanitizeFileName(fileName);
    const fileId = randomUUID();
    const objectPath = `${metadata.conversationId}/${fileId}/${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(this.bucket)
      .upload(objectPath, fileBuffer, { contentType: mimeType, upsert: false });

    if (uploadError) {
      log.error('Supabase upload failed', { error: uploadError.message, bucket: this.bucket, objectPath });
      throw new Error('Failed to upload file');
    }

    const expiresInSeconds = 60 * 60; // 1 hour
    const { data: signed, error: signError } = await supabase.storage
      .from(this.bucket)
      .createSignedUrl(objectPath, expiresInSeconds);

    if (signError || !signed?.signedUrl) {
      log.warn('Failed to create signed URL for uploaded file', { error: signError?.message, objectPath });
      throw new Error('Failed to create file URL');
    }

    const expiresAt = new Date(Date.now() + (env.storage.chatFileTTLDays || 30) * 24 * 60 * 60 * 1000);

    return {
      fileId,
      fileName: safeName,
      mimeType,
      fileSize: fileBuffer.length,
      url: signed.signedUrl,
      expiresAt,
      bucket: this.bucket,
      objectPath
    };
  }

  async downloadFromGridFS(_fileId: string): Promise<never> {
    throw new Error('Direct streaming is not supported when using Supabase Storage');
  }
}

export const fileStorageService = new FileStorageService();
export type { FileStorageService };

