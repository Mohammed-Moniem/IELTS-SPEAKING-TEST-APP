import { apiClient } from "./client";
import { logger } from "../utils/logger";

const DEFAULT_EXAMINER_FALLBACK_RESPONSE =
  "Thanks for your response. Could you expand on that a little more?";

const sanitizeGeneratedText = (
  input?: string,
  fallback: string = DEFAULT_EXAMINER_FALLBACK_RESPONSE
): string => {
  const trimmed = input?.trim?.() ?? "";
  const cleaned = trimmed.replace(/^(undefined|null)\s*[.,;:!?-]*/i, "").trim();

  if (cleaned.length > 0) {
    return cleaned;
  }

  const fallbackTrimmed = fallback.trim();
  if (fallbackTrimmed.length > 0) {
    return fallbackTrimmed;
  }

  return "Let's continue with the next question.";
};

interface TranscriptionResult {
  text: string;
  language: string;
  duration?: number;
}

interface ExaminerResponse {
  response: string;
  testPart: number;
}

interface EvaluationResult {
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
      linkingPhrases: Array<{
        context: string;
        phrases: string[];
      }>;
    };
    lexicalResource: {
      band: number;
      feedback: string;
      strengths: string[];
      improvements: string[];
      vocabularyAlternatives: Array<{
        original: string;
        alternatives: string[];
        exampleSentence: string;
      }>;
      collocations: Array<{
        phrase: string;
        example: string;
      }>;
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
      detailedExamples: Array<{
        issue: string;
        suggestion: string;
      }>;
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
  corrections: Array<{
    original: string;
    corrected: string;
    explanation: string;
  }>;
  suggestions: string[];
}

/**
 * Upload audio file and get transcription
 */
export const transcribeAudio = async (
  audioUri: string,
  language: string = "en"
): Promise<TranscriptionResult> => {
  try {
    console.log("🎤 Transcribing audio:", audioUri);

    // Create form data
    const formData = new FormData();

    // Extract filename from URI
    const filename = audioUri.split("/").pop() || "recording.m4a";

    // Append audio file
    formData.append("audio", {
      uri: audioUri,
      type: "audio/m4a",
      name: filename,
    } as any);

    formData.append("language", language);

    // Use apiClient for authenticated request with FormData
    const response = await apiClient.post("/speech/transcribe", formData);

    if (!response.data.success) {
      throw new Error(response.data.message || "Transcription failed");
    }

    console.log(
      "✅ Transcription result:",
      response.data.data.text.substring(0, 50) + "..."
    );
    return response.data.data;
  } catch (error) {
    console.warn("⚠️ Transcription request warning:", error);
    throw error;
  }
};

/**
 * Synthesize text to speech and get audio URL
 */
export const synthesizeSpeech = async (
  text: string,
  voiceId?: string,
  speed: number = 1.0
): Promise<string> => {
  try {
    console.log("🔊 Synthesizing speech:", text.substring(0, 50) + "...");

    const response = await apiClient.post("/speech/synthesize", {
      text,
      voiceId,
      speed,
    });

    if (!response.data.success) {
      throw new Error(response.data.message || "Speech synthesis failed");
    }

    const {
      audioBase64,
      mimeType,
      cacheHit,
      voiceId: resolvedVoiceId,
    } = response.data.data;

    if (__DEV__) {
      console.log(
        cacheHit
          ? "♻️ Using cached TTS audio"
          : "✅ Speech synthesized successfully",
        {
          voiceId: resolvedVoiceId,
          chars: text.length,
        }
      );
    }

    const dataUri = `data:${mimeType || "audio/mpeg"};base64,${audioBase64}`;
    return dataUri;
  } catch (error: any) {
    const billingErrorRaw =
      error?.response?.data?.error || error?.response?.data?.message;
    const billingError =
      typeof billingErrorRaw === "string"
        ? billingErrorRaw
        : JSON.stringify(billingErrorRaw || "");
    const isPaymentIssue =
      billingError.toLowerCase().includes("payment_issue") ||
      billingError.toLowerCase().includes("payment_required") ||
      billingError.toLowerCase().includes("paid_plan_required");

    if (isPaymentIssue) {
      const friendlyError = new Error(
        "Premium examiner voice is temporarily unavailable (billing issue)."
      ) as Error & { code?: string };
      friendlyError.code = "ELEVENLABS_BILLING";
      throw friendlyError;
    }

    console.warn("⚠️ Speech synthesis request failed:", error);
    throw error;
  }
};

/**
 * Get AI examiner response based on conversation
 */
export const getExaminerResponse = async (
  conversationHistory: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>,
  testPart: 1 | 2 | 3,
  context?: {
    topic?: string;
    timeRemaining?: number;
    userLevel?: string;
  }
): Promise<ExaminerResponse> => {
  try {
    console.log("🤖 Getting examiner response for Part", testPart);

    const response = await apiClient.post("/speech/examiner/chat", {
      conversationHistory,
      testPart,
      context,
    });

    if (!response.data.success) {
      throw new Error(
        response.data.message || "Failed to get examiner response"
      );
    }

    console.log(
      "✅ Examiner response:",
      response.data.data.response.substring(0, 50) + "..."
    );
    return response.data.data;
  } catch (error) {
    console.warn("⚠️ Examiner response warning:", error);
    throw error;
  }
};

/**
 * Evaluate speaking response and get detailed feedback
 */
export const evaluateResponse = async (
  transcript: string,
  question: string,
  testPart: 1 | 2 | 3
): Promise<EvaluationResult> => {
  try {
    console.log("📊 Evaluating response for Part", testPart);

    const response = await apiClient.post("/speech/evaluate", {
      transcript,
      question,
      testPart,
    });

    if (!response.data.success) {
      throw new Error(response.data.message || "Evaluation failed");
    }

    console.log(
      "✅ Evaluation complete. Band:",
      response.data.data.overallBand
    );
    return response.data.data;
  } catch (error) {
    console.warn("⚠️ Evaluation request warning:", error);
    throw error;
  }
};

export interface FullTestEvaluationQuestionPayload {
  questionId?: string;
  question: string;
  category: "part1" | "part2" | "part3";
  difficulty?: "easy" | "medium" | "hard";
  topic?: string;
}

export interface FullTestEvaluationRecordingPayload {
  partNumber: 1 | 2 | 3;
  questionIndex: number;
  transcript: string;
  durationSeconds: number;
  recordingUrl?: string;
}

export interface EvaluateFullTestRequest {
  testSessionId?: string;
  fullTranscript: string;
  durationSeconds: number;
  questions: FullTestEvaluationQuestionPayload[];
  recordings: FullTestEvaluationRecordingPayload[];
  metadata?: {
    candidateName?: string;
    difficulty?: "beginner" | "intermediate" | "advanced";
    testStartedAt?: string;
    testCompletedAt?: string;
  };
}

export interface FullTestEvaluationSuggestion {
  category?: string;
  suggestion: string;
  priority?: "high" | "medium" | "low";
}

export interface FullTestEvaluationDocument {
  _id: string;
  testSessionId: string;
  userId: string;
  overallBand: number;
  criteria: EvaluationResult["criteria"];
  spokenSummary: string;
  detailedFeedback: string;
  corrections: Array<{
    original: string;
    corrected: string;
    explanation: string;
    category?: string;
  }>;
  suggestions: FullTestEvaluationSuggestion[];
  partScores?: {
    part1?: number;
    part2?: number;
    part3?: number;
  };
  evaluatedAt?: string;
  evaluatedBy?: string;
  evaluatorModel?: string;
}

export interface EvaluateFullTestResponse {
  evaluation: FullTestEvaluationDocument;
  overallBand: number;
  partScores?: {
    part1?: number;
    part2?: number;
    part3?: number;
  };
  spokenSummary: string;
  testSessionId?: string;
}

export const evaluateFullTest = async (
  payload: EvaluateFullTestRequest
): Promise<EvaluateFullTestResponse> => {
  try {
    const response = await apiClient.post("/speech/evaluate-full-test", payload);

    if (!response.data.success) {
      throw new Error(response.data.message || "Full test evaluation failed");
    }

    return response.data.data as EvaluateFullTestResponse;
  } catch (error) {
    logger.warn("Full test evaluation request failed", error);
    throw error;
  }
};

/**
 * Complete conversation flow: transcribe → get response → synthesize
 */
export const processConversationTurn = async (
  audioUri: string,
  conversationHistory: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>,
  testPart: 1 | 2 | 3,
  context?: {
    topic?: string;
    timeRemaining?: number;
    userLevel?: string;
  }
): Promise<{
  userTranscript: string;
  examinerResponse: string;
  audioUrl: string;
}> => {
  try {
    console.log("🔄 Processing conversation turn...");

    // Step 1: Transcribe user's audio
    const transcription = await transcribeAudio(audioUri);
    console.log("📝 User said:", transcription.text);

    // Step 2: Add user's message to conversation history
    const updatedHistory = [
      ...conversationHistory,
      { role: "user" as const, content: transcription.text },
    ];

    // Step 3: Get AI examiner response
    const examinerData = await getExaminerResponse(
      updatedHistory,
      testPart,
      context
    );
    const examinerResponse = sanitizeGeneratedText(examinerData.response);
    console.log("💬 Examiner says:", examinerResponse);

    // Step 4: Synthesize examiner's response to audio
    const audioUrl = await synthesizeSpeech(examinerResponse);

    console.log("✅ Conversation turn complete!");

    return {
      userTranscript: transcription.text,
      examinerResponse,
      audioUrl,
    };
  } catch (error) {
    logger.warn("Conversation turn request failed", error);
    throw error;
  }
};
