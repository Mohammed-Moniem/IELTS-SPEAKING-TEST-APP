import { Request, Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { Body, JsonController, Post, Req, Res } from 'routing-controllers';
import { Service } from 'typedi';
import { Logger } from '../../lib/logger';
import { SpeechService } from '../services/SpeechService';

// Configure multer storage to preserve file extensions
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/audio/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Get file extension from original filename or mimetype
    const ext = path.extname(file.originalname) || getExtensionFromMimetype(file.mimetype);
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${ext}`;
    cb(null, uniqueName);
  }
});

// Helper function to get extension from mimetype
function getExtensionFromMimetype(mimetype: string): string {
  const mimeMap: Record<string, string> = {
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/m4a': '.m4a',
    'audio/wav': '.wav',
    'audio/wave': '.wav',
    'audio/webm': '.webm',
    'audio/ogg': '.ogg',
    'audio/flac': '.flac'
  };
  return mimeMap[mimetype] || '.m4a'; // Default to .m4a
}

// Configure multer for file uploads
const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/m4a', 'audio/ogg', 'audio/flac'];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(mp3|mp4|wav|webm|m4a|ogg|flac)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  }
});

@JsonController('/speech')
@Service()
export class SpeechController {
  private log = new Logger(__filename);

  constructor(private speechService: SpeechService) {}

  @Post('/transcribe')
  public async transcribe(@Req() req: Request, @Res() res: Response): Promise<any> {
    return new Promise((resolve, reject) => {
      upload.single('audio')(req, res, async err => {
        if (err) {
          this.log.error('File upload error:', err);
          return res.status(400).json({
            success: false,
            message: 'File upload failed',
            error: err.message
          });
        }

        const file = req.file;
        if (!file) {
          return res.status(400).json({
            success: false,
            message: 'No audio file provided'
          });
        }

        try {
          const language = (req.body.language as string) || 'en';
          const result = await this.speechService.transcribe(file.path, language);

          // Clean up uploaded file
          fs.unlinkSync(file.path);

          return res.json({
            success: true,
            data: result
          });
        } catch (error: any) {
          this.log.error('Transcription error:', error);

          // Clean up uploaded file on error
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }

          return res.status(500).json({
            success: false,
            message: 'Transcription failed',
            error: error?.message || 'Unknown error'
          });
        }
      });
    });
  }

  @Post('/synthesize')
  public async synthesize(
    @Body()
    body: {
      text: string;
      voiceId?: string;
      speed?: number;
      stability?: number;
      useSpeakerBoost?: boolean;
      cacheKey?: string;
      modelId?: string;
      optimizeStreamingLatency?: number;
    },
    @Res() res: Response
  ): Promise<Response> {
    try {
      const { text, voiceId, stability, useSpeakerBoost, cacheKey, modelId, optimizeStreamingLatency, speed } = body;

      if (!text || text.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Text is required'
        });
      }

      this.log.info(`Synthesizing speech for text: ${text.substring(0, 60)}...`);

      const synthesis = await this.speechService.synthesize(text, {
        voiceId,
        stability,
        useSpeakerBoost,
        cacheKey,
        modelId,
        optimizeStreamingLatency,
        speed
      });

      const audioBase64 = synthesis.buffer.toString('base64');

      return res.json({
        success: true,
        data: {
          audioBase64,
          mimeType: 'audio/mpeg',
          voiceId: synthesis.voiceId,
          cacheHit: synthesis.cacheHit,
          cacheExpiresAt: synthesis.cacheExpiresAt ? new Date(synthesis.cacheExpiresAt).toISOString() : null,
          textLength: text.length
        }
      });
    } catch (error: any) {
      this.log.error('Synthesis error:', error);
      return res.status(500).json({
        success: false,
        message: 'Speech synthesis failed',
        error: error?.message || 'Unknown error'
      });
    }
  }

  @Post('/examiner/chat')
  public async examinerChat(
    @Body()
    body: {
      conversationHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      testPart: number;
      context?: { topic?: string; timeRemaining?: number; userLevel?: string };
    }
  ): Promise<any> {
    try {
      const { conversationHistory, testPart, context } = body;

      if (!conversationHistory || conversationHistory.length === 0) {
        return {
          success: false,
          message: 'Conversation history is required'
        };
      }

      if (!testPart || ![1, 2, 3].includes(testPart)) {
        return {
          success: false,
          message: 'Valid test part (1, 2, or 3) is required'
        };
      }

      this.log.info(`Generating examiner response for Part ${testPart}`);

      const response = await this.speechService.generateExaminerResponse(
        conversationHistory,
        testPart as 1 | 2 | 3,
        context
      );

      return {
        success: true,
        data: {
          response,
          testPart
        }
      };
    } catch (error: any) {
      this.log.error('Examiner chat error:', error);
      return {
        success: false,
        message: 'Failed to generate examiner response',
        error: error?.message || 'Unknown error'
      };
    }
  }

  @Post('/evaluate')
  public async evaluate(@Body() body: { transcript: string; question: string; testPart: number }): Promise<any> {
    try {
      const { transcript, question, testPart } = body;

      if (!transcript || transcript.trim().length === 0) {
        return {
          success: false,
          message: 'Transcript is required'
        };
      }

      if (!question || question.trim().length === 0) {
        return {
          success: false,
          message: 'Question is required'
        };
      }

      if (!testPart || ![1, 2, 3].includes(testPart)) {
        return {
          success: false,
          message: 'Valid test part (1, 2, or 3) is required'
        };
      }

      this.log.info(`Evaluating response for Part ${testPart}`);

      const evaluation = await this.speechService.evaluateResponse(transcript, question, testPart as 1 | 2 | 3);

      return {
        success: true,
        data: evaluation
      };
    } catch (error: any) {
      this.log.error('Evaluation error:', error);
      return {
        success: false,
        message: 'Failed to evaluate response',
        error: error?.message || 'Unknown error'
      };
    }
  }
}
