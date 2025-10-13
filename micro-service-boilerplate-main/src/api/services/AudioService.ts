import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Service } from 'typedi';

interface AudioMetadata {
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
  duration?: number;
}

@Service()
export class AudioService {
  private log = new Logger(__filename);
  private uploadDir: string;

  constructor() {
    // Use uploads directory in project root
    this.uploadDir = path.join(process.cwd(), 'uploads', 'audio');
    this.ensureUploadDirectory();
  }

  /**
   * Save uploaded audio file
   */
  public async saveAudioFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    headers: IRequestHeaders
  ): Promise<AudioMetadata> {
    const logMessage = constructLogMessage(__filename, 'saveAudioFile', headers);

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (buffer.length > maxSize) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Audio file too large (max 50MB)');
    }

    // Validate mime type
    const allowedTypes = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/m4a', 'audio/x-m4a'];
    if (!allowedTypes.includes(mimeType)) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Invalid audio format');
    }

    try {
      // Generate unique filename
      const hash = crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 16);
      const timestamp = Date.now();
      const ext = this.getExtensionFromMimeType(mimeType);
      const fileName = `${timestamp}-${hash}.${ext}`;
      const filePath = path.join(this.uploadDir, fileName);

      // Write file
      await fs.promises.writeFile(filePath, buffer);

      this.log.info(`${logMessage} :: Audio file saved: ${fileName}`);

      return {
        fileName,
        filePath,
        fileSize: buffer.length,
        mimeType,
        uploadedAt: new Date()
      };
    } catch (error: any) {
      this.log.error(`${logMessage} :: Failed to save audio file`, { error: error.message });
      throw new CSError(
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        CODES.GenericErrorMessage,
        'Failed to save audio file'
      );
    }
  }

  /**
   * Delete audio file
   */
  public async deleteAudioFile(filePath: string, headers: IRequestHeaders): Promise<void> {
    const logMessage = constructLogMessage(__filename, 'deleteAudioFile', headers);

    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        this.log.info(`${logMessage} :: Audio file deleted: ${path.basename(filePath)}`);
      }
    } catch (error: any) {
      this.log.warn(`${logMessage} :: Failed to delete audio file`, { error: error.message });
      // Don't throw - file cleanup is not critical
    }
  }

  /**
   * Get audio file info
   */
  public async getAudioInfo(filePath: string): Promise<AudioMetadata | null> {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const stats = await fs.promises.stat(filePath);
      const fileName = path.basename(filePath);
      const ext = path.extname(fileName);
      const mimeType = this.getMimeTypeFromExtension(ext);

      return {
        fileName,
        filePath,
        fileSize: stats.size,
        mimeType,
        uploadedAt: stats.birthtime
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Clean up old audio files (older than 7 days)
   */
  public async cleanupOldFiles(headers: IRequestHeaders): Promise<number> {
    const logMessage = constructLogMessage(__filename, 'cleanupOldFiles', headers);
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    try {
      const files = await fs.promises.readdir(this.uploadDir);

      for (const file of files) {
        const filePath = path.join(this.uploadDir, file);
        const stats = await fs.promises.stat(filePath);

        if (stats.birthtimeMs < sevenDaysAgo) {
          await fs.promises.unlink(filePath);
          deletedCount++;
        }
      }

      this.log.info(`${logMessage} :: Cleaned up ${deletedCount} old audio files`);
      return deletedCount;
    } catch (error: any) {
      this.log.error(`${logMessage} :: Cleanup failed`, { error: error.message });
      return deletedCount;
    }
  }

  private ensureUploadDirectory(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      this.log.info(`Created upload directory: ${this.uploadDir}`);
    }
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const mapping: Record<string, string> = {
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/wav': 'wav',
      'audio/webm': 'webm',
      'audio/m4a': 'm4a',
      'audio/x-m4a': 'm4a'
    };
    return mapping[mimeType] || 'audio';
  }

  private getMimeTypeFromExtension(ext: string): string {
    const mapping: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.wav': 'audio/wav',
      '.webm': 'audio/webm'
    };
    return mapping[ext] || 'application/octet-stream';
  }
}
