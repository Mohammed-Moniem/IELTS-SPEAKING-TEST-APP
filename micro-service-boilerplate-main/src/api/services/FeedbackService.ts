import { env } from '@env';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import OpenAI from 'openai';
import { Service } from 'typedi';

interface FeedbackBandScores {
  overallBand?: number;
  pronunciation?: number;
  fluency?: number;
  lexicalResource?: number;
  grammaticalRange?: number;
}

interface DetailedAnalysis {
  fluencyNotes?: string;
  lexicalNotes?: string;
  grammaticalNotes?: string;
  pronunciationNotes?: string;
}

export interface FluencyAnalysis {
  speechRate: number; // words per minute
  pauseCount: number;
  avgPauseLength: number; // seconds
  hesitationMarkers: string[]; // ["um", "uh", "like"]
  selfCorrections: number;
  fillerWords: string[];
  assessment: string;
}

export interface PronunciationAnalysis {
  clarity: number; // 0-10
  problematicSounds: string[]; // specific phonemes or sound patterns
  wordLevelErrors: Array<{ word: string; issue: string; correction: string }>;
  stressPatterns: string; // assessment of word/sentence stress
  intonation: string; // assessment of intonation patterns
  assessment: string;
}

export interface LexicalAnalysis {
  vocabularyRange: string; // "limited", "adequate", "good", "excellent"
  repetitions: Array<{ word: string; count: number }>;
  sophisticatedWords: string[]; // advanced vocabulary used
  collocations: string[]; // natural word combinations
  idiomaticLanguage: string[];
  inappropriateUsage: Array<{ word: string; context: string; suggestion: string }>;
  assessment: string;
}

export interface GrammaticalAnalysis {
  sentenceComplexity: string; // "mostly simple", "mix of simple and complex", "advanced structures"
  errors: Array<{
    type: string; // "article", "tense", "preposition", "subject-verb agreement"
    example: string;
    correction: string;
    explanation: string;
  }>;
  structureVariety: string[];
  tenseControl: string;
  assessment: string;
}

export interface CoherenceCohesion {
  logicalFlow: number; // 0-10
  linkingWords: string[]; // discourse markers used
  topicDevelopment: string; // how well ideas are developed
  organization: string; // structure and clarity
  assessment: string;
}

export interface FeedbackResult {
  summary: string;
  strengths: string[];
  improvements: string[];
  scores: {
    overallBand: number;
    pronunciation: number;
    fluency: number;
    lexicalResource: number;
    grammaticalRange: number;
  };
  detailedAnalysis?: {
    fluencyNotes?: string;
    lexicalNotes?: string;
    grammaticalNotes?: string;
    pronunciationNotes?: string;
  };
  // Extended analysis fields
  fluencyAnalysis?: FluencyAnalysis;
  pronunciationAnalysis?: PronunciationAnalysis;
  lexicalAnalysis?: LexicalAnalysis;
  grammaticalAnalysis?: GrammaticalAnalysis;
  coherenceCohesion?: CoherenceCohesion;
  model?: string;
}

@Service()
export class FeedbackService {
  private log = new Logger(__filename);
  private client?: OpenAI;

  constructor() {
    if (env.openai.apiKey) {
      this.client = new OpenAI({ apiKey: env.openai.apiKey });
    }
  }

  public isAIEnabled() {
    return Boolean(this.client);
  }

  public async generatePracticeFeedback(
    question: string,
    response: string,
    targetBand: string | undefined,
    headers: IRequestHeaders
  ): Promise<FeedbackResult> {
    const logMessage = constructLogMessage(__filename, 'generatePracticeFeedback', headers);

    if (!this.client) {
      this.log.debug(`${logMessage} :: OpenAI disabled, generating heuristic feedback`);
      return this.generateFallbackFeedback(response);
    }

    try {
      const prompt = this.buildPrompt(question, response, targetBand);
      const completion = await this.client.responses.create({
        model: env.openai.model,
        input: prompt,
        max_output_tokens: env.openai.maxTokens,
        temperature: env.openai.temperature
      });

      const textOutput = (completion as any).output_text?.trim();
      if (!textOutput) {
        this.log.warn(`${logMessage} :: Empty response from OpenAI, using fallback`);
        return this.generateFallbackFeedback(response);
      }

      const parsed = this.parseFeedback(textOutput);
      parsed.model = env.openai.model;
      return parsed;
    } catch (error) {
      this.log.error(`${logMessage} :: OpenAI request failed`, { error });
      return this.generateFallbackFeedback(response);
    }
  }

  private buildPrompt(question: string, response: string, targetBand?: string) {
    const wordCount = response.split(/\s+/).length;
    const estimatedDuration = 60; // Assume 60 seconds for practice, adjust if you track actual duration
    const estimatedSpeechRate = Math.round((wordCount / estimatedDuration) * 60);

    return `You are an official IELTS Speaking examiner. Evaluate this candidate's response using the IELTS band descriptors (0-9 scale) and provide COMPREHENSIVE analysis.

Question: ${question}
Target Band: ${targetBand || 'Not specified'}
Candidate Response: ${response}
Word Count: ${wordCount}
Estimated Speech Rate: ${estimatedSpeechRate} words/minute

Evaluate based on these four criteria:

1. FLUENCY AND COHERENCE (0-9):
   - Speech rate and continuity (target: 150-180 wpm)
   - Hesitations, repetitions, self-corrections
   - Logical sequencing and use of cohesive devices
   - Ability to maintain extended discourse
   - Filler words and hesitation markers

2. LEXICAL RESOURCE (0-9):
   - Vocabulary range and precision
   - Use of idiomatic language
   - Paraphrasing ability
   - Appropriacy of word choice
   - Collocations and sophisticated expressions
   - Repetitions and word variety

3. GRAMMATICAL RANGE AND ACCURACY (0-9):
   - Variety of sentence structures (simple, compound, complex)
   - Error frequency and severity
   - Control of tense and aspect
   - Subject-verb agreement
   - Specific error examples with corrections

4. PRONUNCIATION (0-9):
   - Individual sound production
   - Word stress and sentence rhythm
   - Intonation patterns
   - Overall intelligibility
   - Problematic sounds/words

BAND SCORE GUIDELINES:
- 9: Expert user - fully operational, appropriate, accurate, fluent
- 8: Very good user - fully operational with infrequent inaccuracies
- 7: Good user - operational command, occasional inaccuracies
- 6: Competent user - generally effective, some inaccuracies
- 5: Modest user - partial command, frequent problems
- 4: Limited user - basic competence in familiar situations
- 3: Extremely limited user - conveys general meaning only
- 0-2: Non-user to intermittent user

IMPORTANT: Provide detailed analysis in the extended fields. Analyze the actual response text for:
- Specific hesitation markers (um, uh, like, you know, etc.)
- Repeated words and their frequency
- Sophisticated vocabulary actually used
- Grammar errors with actual examples from the response
- Pronunciation issues you can infer from text patterns

Return ONLY valid JSON with this EXACT structure:
{
  "overallBand": 6.5,
  "fluency": 7,
  "lexicalResource": 6,
  "grammaticalRange": 6,
  "pronunciation": 7,
  "summary": "Your response demonstrates good fluency with generally clear pronunciation. You maintained coherent discourse throughout.",
  "strengths": [
    "Good speech rate with minimal hesitation",
    "Appropriate vocabulary for the topic",
    "Clear pronunciation making you easily understood"
  ],
  "improvements": [
    "Expand your range of grammatical structures - try using more complex sentences",
    "Work on reducing minor grammatical errors with articles and prepositions",
    "Develop your vocabulary with more topic-specific terms and idiomatic expressions"
  ],
  "detailedAnalysis": {
    "fluencyNotes": "You spoke smoothly with good pace. Minor hesitations when searching for vocabulary.",
    "lexicalNotes": "Adequate vocabulary range. Could benefit from more sophisticated expressions.",
    "grammaticalNotes": "Mix of simple and complex structures. Some article errors noted.",
    "pronunciationNotes": "Clear and intelligible. Good word stress and intonation."
  },
  "fluencyAnalysis": {
    "speechRate": ${estimatedSpeechRate},
    "pauseCount": 5,
    "avgPauseLength": 0.4,
    "hesitationMarkers": ["um", "uh"],
    "selfCorrections": 1,
    "fillerWords": ["like", "you know"],
    "assessment": "Your speech flows naturally with only minor hesitations. Speech rate is appropriate for the band level. Consider reducing filler words to reach band 8+."
  },
  "pronunciationAnalysis": {
    "clarity": 8,
    "problematicSounds": ["th", "r"],
    "wordLevelErrors": [
      {"word": "comfortable", "issue": "stress on wrong syllable", "correction": "COM-for-ta-ble"}
    ],
    "stressPatterns": "Generally good word stress with natural rhythm. Occasional errors in multi-syllable words.",
    "intonation": "Natural intonation with appropriate rise and fall patterns. Good use of stress for emphasis.",
    "assessment": "Pronunciation is generally clear and easy to understand. Work on specific problematic sounds and word stress in longer words."
  },
  "lexicalAnalysis": {
    "vocabularyRange": "good",
    "repetitions": [
      {"word": "important", "count": 3},
      {"word": "think", "count": 4}
    ],
    "sophisticatedWords": ["beneficial", "significant", "consequently"],
    "collocations": ["make a difference", "take into account"],
    "idiomaticLanguage": ["it goes without saying"],
    "inappropriateUsage": [
      {"word": "much people", "context": "there are much people", "suggestion": "many people"}
    ],
    "assessment": "Good range of vocabulary with some sophisticated expressions. Reduce word repetitions and expand your repertoire of synonyms."
  },
  "grammaticalAnalysis": {
    "sentenceComplexity": "mix of simple and complex",
    "errors": [
      {
        "type": "article",
        "example": "I went to school",
        "correction": "I went to the school / I went to school (if referring to education in general)",
        "explanation": "Articles can be tricky - use 'the' for specific places, omit for general concepts"
      },
      {
        "type": "tense",
        "example": "I am living here since 2020",
        "correction": "I have been living here since 2020",
        "explanation": "Use present perfect continuous for actions that started in the past and continue to the present"
      }
    ],
    "structureVariety": ["simple sentences", "compound sentences with 'and/but'", "complex sentences with relative clauses", "conditional structures"],
    "tenseControl": "Mostly consistent with occasional errors when using perfect tenses",
    "assessment": "Good variety of sentence structures showing grammatical range. Focus on mastering article usage and perfect tenses for higher bands."
  },
  "coherenceCohesion": {
    "logicalFlow": 7,
    "linkingWords": ["firstly", "moreover", "however", "in conclusion"],
    "topicDevelopment": "Ideas are well-developed with relevant examples and explanations. Each point connects logically to the next.",
    "organization": "Clear structure with introduction, main points, and conclusion. Good use of discourse markers.",
    "assessment": "Your response is well-organized and easy to follow. The logical progression of ideas is clear. To reach band 8+, use more sophisticated linking phrases and ensure all ideas are fully extended."
  }
}`;
  }

  private parseFeedback(raw: string): FeedbackResult {
    try {
      // Strip markdown code block wrappers if present (same fix as TopicGenerationService)
      let cleanedContent = raw.trim();

      // Remove ```json and ``` markers
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      cleanedContent = cleanedContent.trim();

      const jsonStart = cleanedContent.indexOf('{');
      const jsonString = jsonStart >= 0 ? cleanedContent.slice(jsonStart) : cleanedContent;
      const data = JSON.parse(jsonString);

      const result: FeedbackResult = {
        summary: data.summary || 'Great effort! Keep practicing to improve your fluency and confidence.',
        strengths: data.strengths || ['Clear ideas', 'Good vocabulary usage'],
        improvements: data.improvements || ['Work on pronunciation clarity', 'Add more varied sentence structures'],
        scores: {
          overallBand: data.overallBand || 6.5,
          pronunciation: data.pronunciation || 6,
          fluency: data.fluency || 6,
          lexicalResource: data.lexicalResource || 6,
          grammaticalRange: data.grammaticalRange || 6
        }
      };

      // Add detailed analysis if present
      if (data.detailedAnalysis) {
        result.detailedAnalysis = data.detailedAnalysis;
      }

      // Add extended analysis fields if present
      if (data.fluencyAnalysis) {
        result.fluencyAnalysis = data.fluencyAnalysis;
      }

      if (data.pronunciationAnalysis) {
        result.pronunciationAnalysis = data.pronunciationAnalysis;
      }

      if (data.lexicalAnalysis) {
        result.lexicalAnalysis = data.lexicalAnalysis;
      }

      if (data.grammaticalAnalysis) {
        result.grammaticalAnalysis = data.grammaticalAnalysis;
      }

      if (data.coherenceCohesion) {
        result.coherenceCohesion = data.coherenceCohesion;
      }

      return result;
    } catch (error) {
      this.log.warn('Failed to parse AI feedback response, falling back', {
        error,
        rawLength: raw.length,
        rawStart: raw.substring(0, 100)
      });
      return this.generateFallbackFeedback('');
    }
  }

  private generateFallbackFeedback(response: string): FeedbackResult {
    const lengthScore = Math.min(9, Math.max(5, Math.round(response.split(' ').length / 10)));

    return {
      summary:
        'Thank you for your response! Focus on speaking naturally, organizing your ideas clearly, and using a mix of vocabulary and grammar structures.',
      strengths: [
        'You attempted to cover key points of the prompt',
        'Your response shows willingness to engage with the topic'
      ],
      improvements: [
        'Try adding more descriptive details',
        'Practice pronunciation by recording yourself and listening back'
      ],
      scores: {
        overallBand: lengthScore,
        pronunciation: Math.max(5, lengthScore - 1),
        fluency: lengthScore,
        lexicalResource: Math.max(5, lengthScore - 1),
        grammaticalRange: Math.max(5, lengthScore - 1)
      },
      model: 'fallback'
    };
  }
}
