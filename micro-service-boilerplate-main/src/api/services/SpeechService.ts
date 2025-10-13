import { createHash } from 'crypto';
import fs from 'fs';
import OpenAI from 'openai';
import { Service } from 'typedi';
import { env } from '../../env';
import { Logger } from '../../lib/logger';

@Service()
export class SpeechService {
  private log = new Logger(__filename);
  private openai: OpenAI;
  private audioCache = new Map<string, { buffer: Buffer; expiresAt: number }>();

  constructor() {
    this.openai = new OpenAI({
      apiKey: env.openai.apiKey
    });
  }

  /**
   * Transcribe audio file to text using OpenAI Whisper
   */
  public async transcribe(
    audioPath: string,
    language = 'en'
  ): Promise<{
    text: string;
    language: string;
    duration?: number;
  }> {
    try {
      this.log.info(`Transcribing audio file: ${audioPath}`);

      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
        language,
        response_format: 'verbose_json' // Get more details
      });

      this.log.info(`Transcription completed: ${transcription.text.substring(0, 50)}...`);

      return {
        text: transcription.text,
        language: transcription.language || language,
        duration: transcription.duration
      };
    } catch (error: any) {
      this.log.error('Transcription failed:', error);
      throw new Error(`Transcription failed: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Synthesize text to speech using ElevenLabs
   */
  public async synthesize(
    text: string,
    options: {
      voiceId?: string;
      modelId?: string;
      stability?: number;
      useSpeakerBoost?: boolean;
      cacheKey?: string;
      optimizeStreamingLatency?: number;
      speed?: number;
    } = {}
  ): Promise<{
    buffer: Buffer;
    cacheHit: boolean;
    voiceId: string;
    cacheExpiresAt: number | null;
  }> {
    const trimmed = text?.trim();
    if (!trimmed) {
      throw new Error('Text is required for synthesis');
    }

    if (!env.elevenlabs?.apiKey) {
      throw new Error('ElevenLabs API key is not configured on the server');
    }

    const voiceId = options.voiceId || env.elevenlabs.voiceId;
    if (!voiceId) {
      throw new Error('No ElevenLabs voice ID configured');
    }

    const modelId = options.modelId || env.elevenlabs.modelId || 'eleven_v3';
    const rawStability = options.stability ?? env.elevenlabs.stability ?? 0.5;
    // ElevenLabs TTD stability must be exactly 0.0, 0.5, or 1.0
    const stability = this.snapToAllowedStability(rawStability);
    const speed = this.clamp(options.speed ?? env.elevenlabs.speed ?? 1.0, 0.5, 2.0);
    const useSpeakerBoost = options.useSpeakerBoost ?? true;
    const optimizeStreamingLatency = options.optimizeStreamingLatency ?? env.elevenlabs.optimizeStreamingLatency ?? 0;
    const cacheTtlMs = Math.max(0, (env.elevenlabs.cacheTtlSeconds ?? 0) * 1000);

    const cacheKey =
      options.cacheKey || this.getSynthesisCacheKey(trimmed, voiceId, modelId, stability, speed, useSpeakerBoost);

    this.pruneExpiredCache();
    const cached = this.audioCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      this.log.info(`Returning cached ElevenLabs audio (voice: ${voiceId})`);
      return {
        buffer: cached.buffer,
        cacheHit: true,
        voiceId,
        cacheExpiresAt: cached.expiresAt
      };
    }

    this.log.info(`Synthesizing speech via ElevenLabs voice=${voiceId} text="${trimmed.substring(0, 60)}..."`);

    const requestPayload: Record<string, unknown> = {
      text: trimmed,
      model_id: modelId,
      voice_settings: {
        stability,
        use_speaker_boost: useSpeakerBoost
      },
      voice_speed: speed
    };

    if (optimizeStreamingLatency > 0) {
      requestPayload.optimize_streaming_latency = optimizeStreamingLatency;
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': env.elevenlabs.apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg'
      },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.log.error('ElevenLabs synthesis failed', {
        status: response.status,
        statusText: response.statusText,
        body: errorBody
      });
      throw new Error(`ElevenLabs synthesis failed (${response.status}): ${errorBody}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    this.log.info(
      `ElevenLabs synthesis completed (voice=${voiceId}, bytes=${buffer.length}, cacheTtlMs=${cacheTtlMs})`
    );

    let cacheExpiresAt: number | null = null;
    if (cacheTtlMs > 0) {
      cacheExpiresAt = now + cacheTtlMs;
      this.audioCache.set(cacheKey, {
        buffer,
        expiresAt: cacheExpiresAt
      });
      this.enforceCacheSizeLimit();
    }

    return {
      buffer,
      cacheHit: false,
      voiceId,
      cacheExpiresAt
    };
  }

  /**
   * Generate IELTS examiner response using GPT-4
   */
  public async generateExaminerResponse(
    conversationHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    testPart: 1 | 2 | 3,
    context?: {
      topic?: string;
      timeRemaining?: number;
      userLevel?: string;
    }
  ): Promise<string> {
    try {
      this.log.info(`Generating examiner response for Part ${testPart}`);

      // System prompt for IELTS examiner
      const systemPrompt = this.getExaminerSystemPrompt(testPart, context);

      const messages = [{ role: 'system' as const, content: systemPrompt }, ...conversationHistory];

      const completion = await this.openai.chat.completions.create({
        model: env.openai.model || 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 200 // Keep responses concise like real examiner
      });

      const response = completion.choices[0].message.content || '';
      this.log.info(`Examiner response generated: ${response.substring(0, 50)}...`);

      return response;
    } catch (error: any) {
      this.log.error('Examiner response generation failed:', error);
      throw new Error(`Failed to generate examiner response: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Evaluate IELTS speaking response
   */
  public async evaluateResponse(
    transcript: string,
    question: string,
    testPart: 1 | 2 | 3
  ): Promise<{
    overallBand: number;
    spokenSummary: string;
    criteria: {
      fluencyCoherence: {
        band: number;
        feedback: string;
        strengths: string[];
        improvements: string[];
        detailedExamples: Array<{
          issue: string;
          yourResponse: string;
          betterAlternative: string;
          explanation: string;
        }>;
        linkingPhrases: Array<{ context: string; phrases: string[] }>;
      };
      lexicalResource: {
        band: number;
        feedback: string;
        strengths: string[];
        improvements: string[];
        vocabularyAlternatives: Array<{ original: string; alternatives: string[]; exampleSentence: string }>;
        collocations: Array<{ phrase: string; example: string }>;
      };
      grammaticalRange: {
        band: number;
        feedback: string;
        strengths: string[];
        improvements: string[];
        detailedExamples: Array<{
          issue: string;
          yourResponse: string;
          betterAlternative: string;
          explanation: string;
        }>;
      };
      pronunciation: {
        band: number;
        feedback: string;
        strengths: string[];
        improvements: string[];
        detailedExamples: Array<{ issue: string; suggestion: string }>;
      };
    };
    bandComparison: {
      currentBandLabel: string;
      currentBandCharacteristics: string[];
      nextBandLabel: string;
      nextBandCharacteristics: string[];
      nextBandExample: {
        band: number;
        title: string;
        response: string;
        highlights: string[];
      };
      band9Example: string;
    };
    corrections: Array<{ original: string; corrected: string; explanation: string }>;
    suggestions: string[];
  }> {
    try {
      this.log.info(`Evaluating response for Part ${testPart}`);

      const evaluationPrompt = `You are an expert IELTS speaking examiner. Evaluate the candidate's response and produce detailed, actionable feedback that references the transcript directly.

Question: ${question}
Response: ${transcript}
Test Part: ${testPart}

OUTPUT RULES:
- Analyse the transcript carefully – quote exact phrases when highlighting strengths or mistakes.
- Base all feedback on official IELTS Speaking descriptors.
- Return ONLY valid JSON matching the schema below. Do not include commentary, markdown, or explanations outside the JSON.
- Replace every placeholder with rich, specific content. Never use template text like "strength 1" or "characteristic 2".

JSON SCHEMA TO FOLLOW EXACTLY:
{
  "overallBand": <number>,
  "spokenSummary": "<2-3 sentences that mention the overall band score and a single priority improvement>",
  "criteria": {
    "fluencyCoherence": {
      "band": <number>,
      "feedback": "<Overall narrative for this criterion>",
      "strengths": ["<Strength tied to transcript>", "<Another strength>", "<Optional extra strength>"] ,
      "improvements": ["<Specific improvement>", "<Second improvement>", "<Optional extra improvement>"] ,
      "detailedExamples": [
        {
          "issue": "<Describe the fluency/coherence issue>",
          "yourResponse": "<Exact quote from the transcript>",
          "betterAlternative": "<Improved version using stronger linking>",
          "explanation": "<Clarify why the alternative fixes the issue>"
        },
        {
          "issue": "<Another issue>",
          "yourResponse": "<Another quote>",
          "betterAlternative": "<Improved version>",
          "explanation": "<Why it works>"
        }
      ],
      "linkingPhrases": [
        {
          "context": "To add information",
          "phrases": ["Furthermore", "In addition", "Moreover", "What's more"]
        },
        {
          "context": "To contrast ideas",
          "phrases": ["However", "On the other hand", "Nevertheless", "Despite this"]
        },
        {
          "context": "To give examples",
          "phrases": ["For instance", "Such as", "To illustrate", "Take for example"]
        }
      ]
    },
    "lexicalResource": {
      "band": <number>,
      "feedback": "<Overall narrative>",
      "strengths": ["<Strength with vocabulary quote>", "<Another strength>"] ,
      "improvements": ["<Specific vocabulary gap>", "<Another improvement>"] ,
      "vocabularyAlternatives": [
        {
          "original": "<Word or phrase they actually used>",
          "alternatives": ["<higher-level synonym 1>", "<synonym 2>", "<synonym 3>"],
          "exampleSentence": "<New sentence using one alternative in the same context>"
        },
        {
          "original": "<Second overused/basic word>",
          "alternatives": ["<alt 1>", "<alt 2>", "<alt 3>"],
          "exampleSentence": "<Example sentence>"
        },
        {
          "original": "<Third word from transcript>",
          "alternatives": ["<alt 1>", "<alt 2>", "<alt 3>"],
          "exampleSentence": "<Example sentence>"
        }
      ],
      "collocations": [
        {
          "phrase": "<Natural collocation related to the topic>",
          "example": "<Sentence showing the collocation>"
        },
        {
          "phrase": "<Second collocation>",
          "example": "<Sentence>"
        },
        {
          "phrase": "<Third collocation>",
          "example": "<Sentence>"
        }
      ]
    },
    "grammaticalRange": {
      "band": <number>,
      "feedback": "<Overall narrative>",
      "strengths": ["<Grammar strength>", "<Another strength>"] ,
      "improvements": ["<Specific grammar gap>", "<Another improvement>"] ,
      "detailedExamples": [
        {
          "issue": "<Name the grammar problem>",
          "yourResponse": "<Exact quote with the error>",
          "betterAlternative": "<Corrected version>",
          "explanation": "<Rule explanation tied to IELTS expectation>"
        },
        {
          "issue": "<Another grammar problem>",
          "yourResponse": "<Quote>",
          "betterAlternative": "<Corrected version>",
          "explanation": "<Why it's better>"
        }
      ]
    },
    "pronunciation": {
      "band": <number>,
      "feedback": "<Overall narrative>",
      "strengths": ["<Pronunciation strength>", "<Another strength>"] ,
      "improvements": ["<Specific pronunciation skill to work on>", "<Another improvement>"] ,
      "detailedExamples": [
        {
          "issue": "<Specific pronunciation challenge>",
          "suggestion": "<Concrete practice technique>"
        },
        {
          "issue": "<Another challenge>",
          "suggestion": "<Another practice tip>"
        }
      ]
    }
  },
  "bandComparison": {
    "currentBandLabel": "<Band X.Y — descriptor>",
    "currentBandCharacteristics": [
      "<Sentence summarising behaviour observed in transcript>",
      "<Another sentence>",
      "<Third sentence>"
    ],
    "nextBandLabel": "<Band X.Y — descriptor for the NEXT 0.5 band (cap at 9.0)>",
    "nextBandCharacteristics": [
      "<Requirement 1 for the next band, tied to their gaps>",
      "<Requirement 2>",
      "<Requirement 3>"
    ],
    "nextBandExample": {
      "band": <number>,
      "title": "<Short title referencing the question topic>",
      "response": "<4-6 sentence sample answer for the same question that demonstrates the next band level>",
      "highlights": [
        "<Highlight 1 explaining why the sample is next-band level>",
        "<Highlight 2>",
        "<Highlight 3>"
      ]
    },
    "band9Example": "<4-6 sentence aspirational Band 9 response to the SAME question '${question}'>"
  },
  "corrections": [
    {
      "original": "<Exact incorrect phrase from transcript>",
      "corrected": "<Corrected version>",
      "explanation": "<Grammar/usage explanation>"
    },
    {
      "original": "<Second incorrect phrase>",
      "corrected": "<Corrected version>",
      "explanation": "<Explanation>"
    },
    {
      "original": "<Third incorrect phrase>",
      "corrected": "<Corrected version>",
      "explanation": "<Explanation>"
    }
  ],
  "suggestions": [
    "<Actionable suggestion tied to their needs>",
    "<Second actionable suggestion>",
    "<Third actionable suggestion>"
  ]
}

MANDATORY REQUIREMENTS:
1. spokenSummary MUST mention the overall band explicitly (e.g., "You achieved Band 6.5...").
2. Every array MUST contain at least the number of items shown in the schema above.
3. All "yourResponse" values MUST be direct quotes from the transcript; if the transcript is empty, explain that the user provided no answer and tailor feedback accordingly.
4. vocabularyAlternatives must use real words from the transcript as the "original" value.
5. nextBandExample.response must be newly written for the next band level (do not reuse the candidate's text).
6. Do not invent facts that contradict the transcript; align feedback with what they actually said.
7. Do not output placeholder text, angle brackets, or curly-brace comments.

Return only the JSON object.`;

      const completion = await this.openai.chat.completions.create({
        model: env.openai.model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: evaluationPrompt }],
        temperature: 0.3, // Lower for more consistent evaluation
        response_format: { type: 'json_object' }
      });

      const evaluation = JSON.parse(completion.choices[0].message.content || '{}');
      this.log.info(`Evaluation completed. Overall band: ${evaluation.overallBand}`);

      return evaluation;
    } catch (error: any) {
      this.log.error('Evaluation failed:', error);
      throw new Error(`Failed to evaluate response: ${error?.message || 'Unknown error'}`);
    }
  }

  private getExaminerSystemPrompt(
    testPart: 1 | 2 | 3,
    context?: { topic?: string; timeRemaining?: number; userLevel?: string }
  ): string {
    const basePr = `You are an IELTS Speaking Test examiner. Be professional, clear, and encouraging.`;

    switch (testPart) {
      case 1:
        return `${basePr}
Part 1: Introduction and Interview (4-5 minutes)
- Ask general questions about familiar topics (home, family, work, studies, interests)
- Ask 2-3 questions per topic
- Keep questions simple and personal
- Be warm and friendly to help candidate relax
${context?.topic ? `Current topic: ${context.topic}` : ''}`;

      case 2:
        return `${basePr}
Part 2: Individual Long Turn (3-4 minutes)
- Give the candidate a topic card with points to cover
- Allow 1 minute preparation time
- Ask them to speak for 2 minutes
- Ask 1-2 brief follow-up questions
- Topics should be about personal experiences or descriptions
${context?.topic ? `Current topic: ${context.topic}` : ''}`;

      case 3:
        return `${basePr}
Part 3: Two-way Discussion (4-5 minutes)
- Ask abstract, analytical questions related to Part 2 topic
- Discuss broader issues and concepts
- Encourage deeper thinking and complex responses
- Questions should be more challenging than Part 1
${context?.topic ? `Related to: ${context.topic}` : ''}`;

      default:
        return basePr;
    }
  }

  private pruneExpiredCache(): void {
    if (this.audioCache.size === 0) {
      return;
    }

    const now = Date.now();
    for (const [key, entry] of this.audioCache.entries()) {
      if (entry.expiresAt <= now) {
        this.audioCache.delete(key);
      }
    }
  }

  private enforceCacheSizeLimit(maxEntries = 128): void {
    if (this.audioCache.size <= maxEntries) {
      return;
    }

    const surplus = this.audioCache.size - maxEntries;
    const keys = Array.from(this.audioCache.keys());
    for (let index = 0; index < surplus; index += 1) {
      const keyToRemove = keys[index];
      if (keyToRemove) {
        this.audioCache.delete(keyToRemove);
      }
    }
  }

  private getSynthesisCacheKey(
    text: string,
    voiceId: string,
    modelId: string,
    stability: number,
    speed: number,
    useSpeakerBoost: boolean
  ): string {
    return createHash('sha256')
      .update(`${voiceId}|${modelId}|${stability}|${speed}|${useSpeakerBoost}|${text}`)
      .digest('hex');
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Snap stability value to nearest allowed ElevenLabs TTD value
   * ElevenLabs requires exactly 0.0, 0.5, or 1.0
   */
  private snapToAllowedStability(value: number): number {
    const allowedValues = [0.0, 0.5, 1.0];
    // Find the closest allowed value
    return allowedValues.reduce((prev, curr) => (Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev));
  }
}
