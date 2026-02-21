import { env } from '@env';
import { deleteRowsByIds, loadTableRows, upsertRow } from '@lib/db/documentStore';
import { generateMongoStyleId } from '@lib/db/id';
import {
  createSupabaseSignedUrl,
  deleteFromSupabaseStorage,
  downloadFromSupabaseStorage,
  uploadToSupabaseStorage
} from '@lib/db/supabaseStorage';
import { EXTRA_TABLES } from '@lib/db/tableMappings';
import { S3 } from 'aws-sdk';
import { Readable } from 'stream';
import { Logger } from '../../lib/logger';

const log = new Logger(__filename);

export interface UploadedFile {
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  url: string;
  thumbnailUrl?: string;
  expiresAt: Date;
}

export interface FileMetadata {
  userId: string;
  conversationId: string;
  messageType: 'image' | 'video' | 'audio' | 'file' | 'gif';
  duration?: number;
  width?: number;
  height?: number;
  waveformData?: number[];
}

interface StoredChatFile {
  _id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  provider: 'supabase' | 's3';
  bucket: string;
  objectPath: string;
  expiresAt: string;
  metadata: FileMetadata;
  createdAt: string;
}

class FileStorageService {
  private s3Client: S3 | null = null;

  constructor() {
    if (env.storage.provider === 's3') {
      this.initializeS3();
    }
  }

  private initializeS3(): void {
    if (!env.storage.s3.accessKeyId || !env.storage.s3.secretAccessKey) {
      log.warn('S3 credentials not configured, S3 provider will fail');
      return;
    }

    this.s3Client = new S3({
      accessKeyId: env.storage.s3.accessKeyId,
      secretAccessKey: env.storage.s3.secretAccessKey,
      region: env.storage.s3.region
    });
  }

  private getEffectiveProvider(): 'supabase' | 's3' {
    if (env.storage.provider === 's3') {
      return 's3';
    }

    if (env.storage.provider === 'mongodb') {
      log.warn('MongoDB storage provider is deprecated. Falling back to Supabase storage.');
    }

    return 'supabase';
  }

  private async listStoredFiles(): Promise<StoredChatFile[]> {
    const rows = await loadTableRows(EXTRA_TABLES.chatFiles);
    return rows.map(row => ({
      _id: row.id,
      ...(row.data as StoredChatFile)
    }));
  }

  private async getStoredFile(fileId: string): Promise<StoredChatFile> {
    const files = await this.listStoredFiles();
    const file = files.find(candidate => candidate._id === fileId);
    if (!file) {
      throw new Error('File not found');
    }

    return file;
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

    const provider = this.getEffectiveProvider();
    const fileId = generateMongoStyleId();
    const objectPath = `chat-files/${metadata.conversationId}/${fileId}/${fileName}`;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.storage.chatFileTTLDays);

    if (provider === 's3') {
      if (!this.s3Client) {
        throw new Error('S3 client not initialized');
      }

      await this.s3Client
        .upload({
          Bucket: env.storage.s3.chatFilesBucket,
          Key: objectPath,
          Body: fileBuffer,
          ContentType: mimeType
        })
        .promise();

      const signedUrl = this.s3Client.getSignedUrl('getObject', {
        Bucket: env.storage.s3.chatFilesBucket,
        Key: objectPath,
        Expires: env.storage.s3.signedUrlExpiry
      });

      await upsertRow(EXTRA_TABLES.chatFiles, fileId, {
        fileName,
        mimeType,
        fileSize: fileBuffer.length,
        provider,
        bucket: env.storage.s3.chatFilesBucket,
        objectPath,
        expiresAt: expiresAt.toISOString(),
        metadata,
        createdAt: new Date().toISOString()
      });

      return {
        fileId,
        fileName,
        mimeType,
        fileSize: fileBuffer.length,
        url: signedUrl,
        expiresAt
      };
    }

    await uploadToSupabaseStorage(env.storage.supabase.chatBucket, objectPath, fileBuffer, mimeType);

    await upsertRow(EXTRA_TABLES.chatFiles, fileId, {
      fileName,
      mimeType,
      fileSize: fileBuffer.length,
      provider,
      bucket: env.storage.supabase.chatBucket,
      objectPath,
      expiresAt: expiresAt.toISOString(),
      metadata,
      createdAt: new Date().toISOString()
    });

    return {
      fileId,
      fileName,
      mimeType,
      fileSize: fileBuffer.length,
      // Keep existing API contract for retrieval endpoint.
      url: `/api/v1/chat/files/${fileId}`,
      expiresAt
    };
  }

  async downloadFromGridFS(fileId: string): Promise<{ stream: Readable; metadata: any }> {
    const file = await this.getStoredFile(fileId);

    if (file.provider === 's3') {
      if (!this.s3Client) {
        throw new Error('S3 client not initialized');
      }

      const s3Stream = this.s3Client
        .getObject({
          Bucket: file.bucket,
          Key: file.objectPath
        })
        .createReadStream();

      return {
        stream: s3Stream,
        metadata: {
          filename: file.fileName,
          contentType: file.mimeType,
          length: file.fileSize
        }
      };
    }

    const buffer = await downloadFromSupabaseStorage(file.bucket, file.objectPath);
    return {
      stream: Readable.from(buffer),
      metadata: {
        filename: file.fileName,
        contentType: file.mimeType,
        length: file.fileSize
      }
    };
  }

  async deleteFile(fileId: string): Promise<void> {
    const file = await this.getStoredFile(fileId);

    if (file.provider === 's3') {
      if (!this.s3Client) {
        throw new Error('S3 client not initialized');
      }

      await this.s3Client
        .deleteObject({
          Bucket: file.bucket,
          Key: file.objectPath
        })
        .promise();
    } else {
      await deleteFromSupabaseStorage(file.bucket, file.objectPath);
    }

    await deleteRowsByIds(EXTRA_TABLES.chatFiles, [fileId]);
  }

  async resolveSignedUrl(fileId: string): Promise<string> {
    const file = await this.getStoredFile(fileId);
    if (file.provider === 's3') {
      if (!this.s3Client) {
        throw new Error('S3 client not initialized');
      }

      return this.s3Client.getSignedUrl('getObject', {
        Bucket: file.bucket,
        Key: file.objectPath,
        Expires: env.storage.s3.signedUrlExpiry
      });
    }

    return createSupabaseSignedUrl(file.bucket, file.objectPath);
  }

  getProvider(): string {
    return this.getEffectiveProvider();
  }
}

export const fileStorageService = new FileStorageService();
