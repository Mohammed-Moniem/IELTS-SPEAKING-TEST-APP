import { env } from '@env';
import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import * as fs from 'fs';
import OpenAI from 'openai';
import * as path from 'path';
import { Service } from 'typedi';

interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  confidence?: number;
}

@Service()
export class TranscriptionService {
  private log = new Logger(__filename);
  private client?: OpenAI;

  constructor() {
    if (env.openai.apiKey) {
      this.client = new OpenAI({ apiKey: env.openai.apiKey });
    }
  }

  /**
   * Transcribe audio file using OpenAI Whisper API
   */
  public async transcribeAudio(
    audioFilePath: string,
    language: string = 'en',
    headers: IRequestHeaders
  ): Promise<TranscriptionResult> {
    const logMessage = constructLogMessage(__filename, 'transcribeAudio', headers);

    if (!this.client) {
      throw new CSError(
        HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,
        CODES.GenericErrorMessage,
        'Transcription service unavailable'
      );
    }

    if (!fs.existsSync(audioFilePath)) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Audio file not found');
    }

    try {
      this.log.info(`${logMessage} :: Transcribing audio file: ${path.basename(audioFilePath)}`);

      const transcription = await this.client.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model: 'whisper-1',
        language,
        response_format: 'verbose_json'
      });

      this.log.info(`${logMessage} :: Transcription completed`);

      return {
        text: transcription.text,
        language: (transcription as any).language,
        duration: (transcription as any).duration,
        confidence: this.estimateConfidence(transcription.text)
      };
    } catch (error: any) {
      this.log.error(`${logMessage} :: Transcription failed`, { error: error.message });
      throw new CSError(
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        CODES.GenericErrorMessage,
        'Failed to transcribe audio'
      );
    }
  }

  /**
   * Transcribe with timestamps for detailed analysis
   */
  public async transcribeWithTimestamps(
    audioFilePath: string,
    headers: IRequestHeaders
  ): Promise<{
    text: string;
    segments: Array<{ start: number; end: number; text: string }>;
  }> {
    const logMessage = constructLogMessage(__filename, 'transcribeWithTimestamps', headers);

    if (!this.client) {
      throw new CSError(
        HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,
        CODES.GenericErrorMessage,
        'Transcription service unavailable'
      );
    }

    try {
      const transcription = await this.client.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment']
      });

      const segments =
        (transcription as any).segments?.map((seg: any) => ({
          start: seg.start,
          end: seg.end,
          text: seg.text
        })) || [];

      return {
        text: transcription.text,
        segments
      };
    } catch (error: any) {
      this.log.error(`${logMessage} :: Timestamp transcription failed`, { error: error.message });
      throw new CSError(
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        CODES.GenericErrorMessage,
        'Failed to transcribe audio with timestamps'
      );
    }
  }

  /**
   * Estimate confidence based on text characteristics
   * (Whisper doesn't provide confidence scores directly)
   */
  private estimateConfidence(text: string): number {
    // Simple heuristic: longer, more coherent text = higher confidence
    const wordCount = text.split(/\s+/).length;
    const hasProperCapitalization = /[A-Z]/.test(text);
    const hasPunctuation = /[.,!?]/.test(text);

    let confidence = 0.5;

    if (wordCount > 10) confidence += 0.1;
    if (wordCount > 30) confidence += 0.1;
    if (hasProperCapitalization) confidence += 0.15;
    if (hasPunctuation) confidence += 0.15;

    return Math.min(confidence, 1.0);
  }

  /**
   * Detect language from audio
   */
  public async detectLanguage(audioFilePath: string, headers: IRequestHeaders): Promise<string> {
    const logMessage = constructLogMessage(__filename, 'detectLanguage', headers);

    if (!this.client) {
      return 'en'; // Default to English
    }

    try {
      const transcription = await this.client.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model: 'whisper-1',
        response_format: 'verbose_json'
      });

      return (transcription as any).language || 'en';
    } catch (error: any) {
      this.log.warn(`${logMessage} :: Language detection failed, defaulting to English`, { error: error.message });
      return 'en';
    }
  }
}
