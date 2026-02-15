import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { evaluateFullTest, transcribeAudio } from "../api/speechApi";
import {
  GeneratedTopic,
  getCachedRandomTopic,
  topicCache,
} from "../api/topicApi";
import { ttsService } from "../services/textToSpeechService";
import { colors, spacing } from "../theme/tokens";

/**
 * SIMPLIFIED IELTS Full Test - V2
 *
 * NEW APPROACH:
 * - Clear visual mic button (press to record, press again to stop)
 * - Examiner speaks → User presses mic → Speaks → Presses mic again → Next question
 * - Simple, reliable, user-controlled
 *
 * TEST STRUCTURE (11-14 minutes total):
 * Part 1: 4-5 questions (4-5 minutes)
 * Part 2: 1 topic with 1-min prep + 1-2 min speaking (3-4 minutes)
 * Part 3: 3 questions (4-5 minutes)
 */

type TestPhase =
  | "loading"
  | "welcome"
  | "part1"
  | "part2-intro"
  | "part2-prep"
  | "part2-speaking"
  | "part3"
  | "complete";

interface TestProps {
  onComplete: (results: any) => void;
  onExit: () => void;
}

type ResponseRecord = {
  partNumber: 1 | 2 | 3;
  questionIndex: number;
  questionId?: string;
  question: string;
  category: "part1" | "part2" | "part3";
  difficulty?: "easy" | "medium" | "hard";
  topic?: string;
  recordingUri: string;
  transcript?: string;
  durationSeconds?: number;
};

type QuestionPayload = {
  questionId?: string;
  question: string;
  category: "part1" | "part2" | "part3";
  difficulty?: "easy" | "medium" | "hard";
  topic?: string;
};

type RecordingPayload = {
  partNumber: 1 | 2 | 3;
  questionIndex: number;
  transcript: string;
  durationSeconds: number;
  recordingUri?: string;
};

export const AuthenticFullTestV2: React.FC<TestProps> = ({
  onComplete,
  onExit,
}) => {
  // Test state
  const [phase, setPhase] = useState<TestPhase>("loading");
  const [isRecording, setIsRecording] = useState(false);
  const [isExaminerSpeaking, setIsExaminerSpeaking] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Questions
  const [part1Questions, setPart1Questions] = useState<GeneratedTopic[]>([]);
  const [part2Topic, setPart2Topic] = useState<GeneratedTopic | null>(null);
  const [part3Questions, setPart3Questions] = useState<GeneratedTopic[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionsReady, setQuestionsReady] = useState(false);
  const [welcomePrompt, setWelcomePrompt] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Recordings
  const recording = useRef<Audio.Recording | null>(null);
  const part1Answers = useRef<string[]>([]);
  const part2Answer = useRef<string | null>(null);
  const part3Answers = useRef<string[]>([]);
  const responsesRef = useRef<ResponseRecord[]>([]);
  const transcriptionPromisesRef = useRef<Promise<void>[]>([]);
  const testSessionIdRef = useRef<string | undefined>(undefined);
  const isExitingRef = useRef(false);
  const scheduledTimeouts = useRef<NodeJS.Timeout[]>([]);

  // Timing
  const [recordingTime, setRecordingTime] = useState(0);
  const [prepTime, setPrepTime] = useState(60); // 60 seconds prep for Part 2
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const testStartTime = useRef<number>(0);

  const scheduleTimeout = (
    callback: () => void,
    delay: number
  ): NodeJS.Timeout | null => {
    if (isExitingRef.current) {
      return null;
    }

    const timeout = setTimeout(() => {
      scheduledTimeouts.current = scheduledTimeouts.current.filter(
        (t) => t !== timeout
      );
      if (!isExitingRef.current) {
        callback();
      }
    }, delay);

    scheduledTimeouts.current.push(timeout);
    return timeout;
  };

  const clearScheduledTimeouts = () => {
    scheduledTimeouts.current.forEach(clearTimeout);
    scheduledTimeouts.current = [];
  };

  const waitFor = (ms: number) =>
    new Promise<void>((resolve) => {
      const timeout = scheduleTimeout(resolve, ms);
      if (!timeout) {
        resolve();
      }
    });

  const enqueueTranscription = (
    record: ResponseRecord,
    uri: string,
    fallbackDuration: number
  ) => {
    const promise = transcribeAudio(uri)
      .then((result) => {
        if (isExitingRef.current) {
          return;
        }

        record.transcript = result.text ?? "";
        if (typeof result.duration === "number") {
          record.durationSeconds = Math.max(0, Math.round(result.duration));
        } else if (record.durationSeconds === undefined) {
          record.durationSeconds = fallbackDuration;
        }
      })
      .catch((error) => {
        console.error("❌ Transcription failed:", error);
        if (record.transcript === undefined) {
          record.transcript = "";
        }
        if (record.durationSeconds === undefined) {
          record.durationSeconds = fallbackDuration;
        }
      });

    transcriptionPromisesRef.current.push(promise);
  };

  const buildQuestionPayload = (): QuestionPayload[] => {
    const payload: QuestionPayload[] = [];

    part1Questions.forEach((question) => {
      if (!question) {
        return;
      }

      payload.push({
        questionId: question.questionId,
        question: question.question,
        category: "part1",
        difficulty: question.difficulty,
        topic: question.keywords?.[0],
      });
    });

    if (part2Topic) {
      payload.push({
        questionId: part2Topic.questionId,
        question: part2Topic.question,
        category: "part2",
        difficulty: part2Topic.difficulty,
        topic: part2Topic.cueCard?.mainTopic || part2Topic.question,
      });
    }

    part3Questions.forEach((question) => {
      if (!question) {
        return;
      }

      payload.push({
        questionId: question.questionId,
        question: question.question,
        category: "part3",
        difficulty: question.difficulty,
        topic: question.keywords?.[0],
      });
    });

    return payload;
  };

  const mapDifficultyToLevel = (
    difficulty?: "easy" | "medium" | "hard"
  ): "beginner" | "intermediate" | "advanced" => {
    switch (difficulty) {
      case "easy":
        return "beginner";
      case "hard":
        return "advanced";
      default:
        return "intermediate";
    }
  };

  const determineOverallDifficulty = (
    questions: QuestionPayload[]
  ): "beginner" | "intermediate" | "advanced" => {
    const encountered = questions
      .map((question) => question.difficulty)
      .filter(Boolean) as Array<"easy" | "medium" | "hard">;

    if (encountered.includes("hard")) {
      return "advanced";
    }

    if (encountered.includes("medium")) {
      return "intermediate";
    }

    if (encountered.includes("easy")) {
      return "beginner";
    }

    const firstDifficulty = questions.find(
      (question) => question.difficulty
    )?.difficulty;
    return mapDifficultyToLevel(firstDifficulty);
  };

  const buildFullTranscript = (responses: ResponseRecord[]): string => {
    if (!responses.length) {
      return "";
    }

    return responses
      .map((response) => {
        const questionLabel =
          response.partNumber === 2
            ? "Long turn topic"
            : `Question ${response.questionIndex + 1}`;
        const examinerLine = `Examiner: ${response.question}`;
        const candidateLine =
          response.transcript && response.transcript.trim().length > 0
            ? `Candidate: ${response.transcript}`
            : "Candidate: [No transcript captured]";

        return `Part ${response.partNumber} - ${questionLabel}\n${examinerLine}\n${candidateLine}`;
      })
      .join("\n\n");
  };

  const ensureNumber = (value: unknown, fallback = 0): number => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const ensureString = (value: unknown): string => {
    return typeof value === "string" ? value : "";
  };

  const ensureStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  };

  const normalizeCriteriaBlock = (block: any) => {
    return {
      band: ensureNumber(block?.band),
      feedback: ensureString(block?.feedback),
      strengths: ensureStringArray(block?.strengths),
      improvements: ensureStringArray(block?.improvements),
      detailedExamples: Array.isArray(block?.detailedExamples)
        ? block.detailedExamples
        : [],
      linkingPhrases: Array.isArray(block?.linkingPhrases)
        ? block.linkingPhrases
        : [],
      vocabularyAlternatives: Array.isArray(block?.vocabularyAlternatives)
        ? block.vocabularyAlternatives
        : [],
      collocations: Array.isArray(block?.collocations)
        ? block.collocations
        : [],
    };
  };

  const normalizeCriteria = (criteria: any) => {
    return {
      fluencyCoherence: normalizeCriteriaBlock(
        criteria?.fluencyCoherence ?? {}
      ),
      lexicalResource: normalizeCriteriaBlock(criteria?.lexicalResource ?? {}),
      grammaticalRange: normalizeCriteriaBlock(
        criteria?.grammaticalRange ?? {}
      ),
      pronunciation: normalizeCriteriaBlock(criteria?.pronunciation ?? {}),
    };
  };

  const normalizeCorrections = (
    corrections: unknown
  ): Array<{
    original: string;
    corrected: string;
    explanation: string;
  }> => {
    if (!Array.isArray(corrections)) {
      return [];
    }

    return corrections
      .map((item) => ({
        original: ensureString((item as any)?.original),
        corrected: ensureString((item as any)?.corrected),
        explanation: ensureString((item as any)?.explanation),
      }))
      .filter(
        (entry) => entry.original.length > 0 && entry.corrected.length > 0
      );
  };

  const normalizePartScores = (scores: unknown) => {
    if (typeof scores !== "object" || scores === null) {
      return undefined;
    }

    const typedScores = scores as Record<string, unknown>;
    const normalized: Record<string, number> = {};

    ["part1", "part2", "part3"].forEach((key) => {
      const numeric = ensureNumber(typedScores[key]);
      if (Number.isFinite(numeric) && numeric > 0) {
        normalized[key] = numeric;
      }
    });

    return Object.keys(normalized).length ? normalized : undefined;
  };

  // ==================== INITIALIZATION ====================

  useEffect(() => {
    initializeTest();

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handleExit();
        return true;
      }
    );

    return () => {
      isExitingRef.current = true;
      clearScheduledTimeouts();
      void cleanup();
      backHandler.remove();
    };
  }, []);

  // Watch for questions to be loaded, then start test
  useEffect(() => {
    if (questionsReady && part1Questions.length > 0) {
      console.log("✅ Questions confirmed in state, starting welcome...");
      testStartTime.current = Date.now();
      startWelcome();
      setQuestionsReady(false); // Prevent multiple starts
    }
  }, [questionsReady, part1Questions]);

  const initializeTest = async () => {
    try {
      console.log("🎬 Initializing IELTS Full Test V2...");
      responsesRef.current = [];
      transcriptionPromisesRef.current = [];
      testSessionIdRef.current = undefined;
      setIsEvaluating(false);

      // Request audio permissions upfront
      console.log("🔐 Requesting microphone permissions...");
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        console.error("❌ Microphone permission denied");
        Alert.alert(
          "Permission Required",
          "Microphone access is needed for this test.",
          [{ text: "Exit", onPress: onExit }]
        );
        return;
      }
      console.log("✅ Microphone permission granted");

      // Configure audio mode
      console.log("🔧 Configuring audio mode...");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
        duckOthers: false,
      } as any);
      console.log("✅ Audio mode configured");

      // Clear topic cache to get fresh questions for each test
      console.log("🗑️  Clearing topic cache for fresh questions...");
      topicCache.clear();

      // Load questions SEQUENTIALLY to avoid duplicate questions
      console.log("📚 Loading questions...");
      const usedQuestions: string[] = [];

      // Load Part 1 questions one at a time
      const p1: GeneratedTopic[] = [];
      for (let i = 0; i < 4; i++) {
        const topic = await getCachedRandomTopic(
          "part1",
          "medium",
          usedQuestions
        );
        p1.push(topic);
        // Track this question as used
        const questionKey = `1:${topic.question.toLowerCase().trim()}`;
        usedQuestions.push(questionKey);
      }
      console.log("✅ Part 1 questions loaded:", p1.length);
      console.log("Part 1 Questions:", p1.map((q) => q.question).join("\n"));

      const p2 = await getCachedRandomTopic("part2", "medium", usedQuestions);
      console.log("✅ Part 2 topic loaded:", p2.question);
      const p2QuestionKey = `2:${p2.question.toLowerCase().trim()}`;
      usedQuestions.push(p2QuestionKey);

      // Load Part 3 questions one at a time
      const p3: GeneratedTopic[] = [];
      for (let i = 0; i < 3; i++) {
        const topic = await getCachedRandomTopic(
          "part3",
          "medium",
          usedQuestions
        );
        p3.push(topic);
        // Track this question as used
        const questionKey = `3:${topic.question.toLowerCase().trim()}`;
        usedQuestions.push(questionKey);
      }
      console.log("✅ Part 3 questions loaded:", p3.length);

      setPart1Questions(p1);
      setPart2Topic(p2);
      setPart3Questions(p3);

      console.log("✅ All questions set in state");
      console.log("🎯 Setting questionsReady flag...");

      // Set flag to trigger useEffect that will start test
      setQuestionsReady(true);
    } catch (error) {
      console.error("❌ Failed to initialize test:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      Alert.alert(
        "Error",
        `Failed to load test: ${
          error instanceof Error ? error.message : "Unknown error"
        }. Please try again.`,
        [{ text: "Exit", onPress: onExit }]
      );
    }
  };

  const cleanup = async () => {
    clearScheduledTimeouts();

    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }

    if (recording.current) {
      try {
        await recording.current.stopAndUnloadAsync();
      } catch (error) {
        console.log("Recording cleanup error:", error);
      } finally {
        recording.current = null;
      }
    }

    try {
      await ttsService.stop();
    } catch (error) {
      console.log("TTS cleanup error:", error);
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
        duckOthers: false,
      } as any);
    } catch (error) {
      console.log("Audio mode reset error:", error);
    }
  };

  const handleExit = () => {
    Alert.alert("Exit Test?", "Your progress will not be saved.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Exit",
        style: "destructive",
        onPress: () => {
          isExitingRef.current = true;
          setIsExaminerSpeaking(false);
          setPhase("loading");
          setWelcomePrompt(null);
          setIsEvaluating(false);
          clearScheduledTimeouts();
          void cleanup().finally(onExit);
        },
      },
    ]);
  };

  // ==================== PART 1: INTRODUCTION (4-5 minutes) ====================

  const startWelcome = async () => {
    if (isExitingRef.current) {
      return;
    }

    setPhase("welcome");
    setWelcomePrompt(
      "Good morning. My name is Dr. Smith and I will be your examiner today. Can you tell me your full name please?"
    );
    setIsExaminerSpeaking(true);

    await speakAndWait(
      "Good morning. My name is Dr. Smith and I will be your examiner today. Can you tell me your full name please?"
    );

    setIsExaminerSpeaking(false);

    await waitFor(3000);
    if (isExitingRef.current) {
      return;
    }

    setIsExaminerSpeaking(true);
    setWelcomePrompt(
      "Thank you. Could you please show me your identification document?"
    );
    await speakAndWait(
      "Thank you. Could you please show me your identification document?"
    );
    setIsExaminerSpeaking(false);

    await waitFor(3000);
    if (isExitingRef.current) {
      return;
    }

    setIsExaminerSpeaking(true);
    setWelcomePrompt("Great, let's begin with Part 1 of the test.");
    await speakAndWait("Thank you. Let's begin with Part 1 of the test.");
    setIsExaminerSpeaking(false);

    scheduleTimeout(() => {
      setWelcomePrompt(null);
      startPart1();
    }, 1500);
  };

  const startPart1 = async () => {
    if (isExitingRef.current) {
      return;
    }

    console.log("\n🚀 startPart1 called");
    console.log("📊 Current part1Questions state:", part1Questions);
    console.log("📏 part1Questions.length:", part1Questions?.length);

    // Validate questions loaded
    if (!part1Questions || part1Questions.length === 0) {
      console.error("❌ No Part 1 questions available!");
      console.error("❌ State check: part1Questions is", part1Questions);
      Alert.alert(
        "Error",
        "Failed to load Part 1 questions. Cannot start test.",
        [{ text: "Exit", onPress: onExit }]
      );
      return;
    }

    console.log("✅ Part 1 validation passed!");
    setPhase("part1");
    setWelcomePrompt(null);
    setCurrentQuestionIndex(0);
    askPart1Question(0);
  };

  const askPart1Question = async (index: number) => {
    if (isExitingRef.current) {
      return;
    }

    console.log(`\n📝 askPart1Question called with index: ${index}`);
    console.log(`part1Questions array length: ${part1Questions.length}`);
    console.log(`part1Questions:`, part1Questions);

    // Check if all questions answered
    if (index >= part1Questions.length) {
      // Part 1 complete
      console.log("✅ All Part 1 questions answered, finishing Part 1");
      finishPart1();
      return;
    }

    const question = part1Questions[index];
    if (!question || !question.question) {
      console.error("❌ Invalid question at index", index);
      console.error("Question object:", question);
      Alert.alert(
        "Error",
        "Failed to load question. Moving to next question.",
        [
          {
            text: "OK",
            onPress: () => {
              setCurrentQuestionIndex(index + 1);
              if (index + 1 < part1Questions.length) {
                if (!isExitingRef.current) {
                  askPart1Question(index + 1);
                }
              } else if (!isExitingRef.current) {
                finishPart1();
              }
            },
          },
        ]
      );
      return;
    }

    setCurrentQuestionIndex(index);
    setIsTransitioning(false);
    setIsExaminerSpeaking(true);

    console.log(`\n📝 Part 1 - Question ${index + 1}/${part1Questions.length}`);
    console.log(`❓ EXAMINER ASKS: "${question.question}"`);

    await speakAndWait(question.question);

    setIsExaminerSpeaking(false);

    // Now user can press mic button to answer
    console.log("🎤 Waiting for user to press mic button...");
    console.log("💬 [USER'S TURN - Press blue mic button to answer]");
  };

  const finishPart1 = async () => {
    if (isExitingRef.current) {
      return;
    }

    console.log("\n✅ Part 1 complete!");

    setIsExaminerSpeaking(true);
    const transition =
      "Thank you. That's the end of Part 1. Now let's move on to Part 2.";
    await speakAndWait(transition);
    setIsExaminerSpeaking(false);

    if (isExitingRef.current) {
      return;
    }

    scheduleTimeout(() => {
      startPart2();
    }, 2000);
  };

  // ==================== PART 2: LONG TURN (3-4 minutes) ====================

  const startPart2 = async () => {
    if (isExitingRef.current) {
      return;
    }

    console.log("\n📝 Starting Part 2...");
    console.log("part2Topic:", part2Topic);

    if (!part2Topic) {
      console.error("❌ No Part 2 topic!");
      Alert.alert("Error", "Failed to load Part 2 topic. Skipping to Part 3.", [
        { text: "OK", onPress: () => startPart3() },
      ]);
      return;
    }

    if (!part2Topic.question) {
      console.error("❌ Part 2 topic has no question!");
      console.error("Topic object:", part2Topic);
      Alert.alert(
        "Error",
        "Failed to load Part 2 question. Skipping to Part 3.",
        [{ text: "OK", onPress: () => startPart3() }]
      );
      return;
    }

    setPhase("part2-intro");
    setIsExaminerSpeaking(true);

    console.log("✅ Part 2 topic is valid, starting intro");

    const intro =
      "Now I'm going to give you a topic and I'd like you to talk about it for one to two minutes. Before you talk, you'll have one minute to think about what you're going to say.";
    console.log(`\n❓ EXAMINER SAYS: "${intro}"`);
    await speakAndWait(intro);

    // Read the cue card
    const cueCard = `Here is your topic: ${part2Topic.question}`;
    console.log(`\n� EXAMINER READS CUE CARD: "${cueCard}"`);
    await speakAndWait(cueCard);

    setIsExaminerSpeaking(false);

    // Start 1-minute preparation
    console.log("⏱️ Starting Part 2 preparation...");
    startPart2Prep();
  };

  const startPart2Prep = () => {
    setPhase("part2-prep");
    setPrepTime(60);

    console.log("⏱️  1 minute preparation time starting...");

    timerInterval.current = setInterval(() => {
      setPrepTime((prev) => {
        if (prev <= 1) {
          clearInterval(timerInterval.current!);
          timerInterval.current = null;
          // Preparation complete
          scheduleTimeout(() => {
            promptPart2Speaking();
          }, 500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const promptPart2Speaking = async () => {
    setIsExaminerSpeaking(true);
    const prompt = "Please begin speaking now.";
    console.log(`\n❓ EXAMINER SAYS: "${prompt}"`);
    await speakAndWait(prompt);
    setIsExaminerSpeaking(false);

    setPhase("part2-speaking");
    console.log(
      "💬 [USER'S TURN - Press blue mic button to speak for 1-2 minutes]"
    );
  };

  const finishPart2 = async () => {
    if (isExitingRef.current) {
      return;
    }

    console.log("\n✅ Part 2 complete!");

    setIsExaminerSpeaking(true);
    const transition =
      "Thank you. Now we'll move on to Part 3, where I'll ask you some more abstract questions.";
    console.log(`\n❓ EXAMINER SAYS: "${transition}"`);
    await speakAndWait(transition);
    setIsExaminerSpeaking(false);

    if (isExitingRef.current) {
      return;
    }

    console.log("\n➡️ Moving to Part 3...\n");
    scheduleTimeout(() => {
      startPart3();
    }, 2000);
  };

  // ==================== PART 3: DISCUSSION (4-5 minutes) ====================

  const startPart3 = () => {
    if (isExitingRef.current) {
      return;
    }

    // Validate questions loaded
    if (!part3Questions || part3Questions.length === 0) {
      console.error("❌ No Part 3 questions available!");
      Alert.alert("Error", "Failed to load Part 3 questions. Ending test.", [
        { text: "Finish", onPress: completeTest },
      ]);
      return;
    }

    setPhase("part3");
    setCurrentQuestionIndex(0);
    askPart3Question(0);
  };

  const askPart3Question = async (index: number) => {
    if (isExitingRef.current) {
      return;
    }

    console.log(`\n📝 askPart3Question called with index: ${index}`);
    console.log(`part3Questions array length: ${part3Questions.length}`);

    if (index >= part3Questions.length) {
      // Part 3 complete
      console.log("✅ All Part 3 questions answered, finishing Part 3");
      finishPart3();
      return;
    }

    const question = part3Questions[index];
    if (!question || !question.question) {
      console.error("❌ Invalid question at index", index);
      console.error("Question object:", question);
      Alert.alert(
        "Error",
        "Failed to load question. Moving to next question.",
        [
          {
            text: "OK",
            onPress: () => {
              setCurrentQuestionIndex(index + 1);
              if (index + 1 < part3Questions.length) {
                if (!isExitingRef.current) {
                  askPart3Question(index + 1);
                }
              } else if (!isExitingRef.current) {
                finishPart3();
              }
            },
          },
        ]
      );
      return;
    }

    setCurrentQuestionIndex(index);
    setIsTransitioning(false);
    setIsExaminerSpeaking(true);

    console.log(`\n📝 Part 3 - Question ${index + 1}/${part3Questions.length}`);
    console.log(`❓ EXAMINER ASKS: "${question.question}"`);

    await speakAndWait(question.question);

    setIsExaminerSpeaking(false);

    // Now user can press mic button to answer
    console.log("🎤 Waiting for user to press mic button...");
    console.log("💬 [USER'S TURN - Press blue mic button to answer]");
  };

  const finishPart3 = async () => {
    if (isExitingRef.current) {
      return;
    }

    console.log("\n✅ Part 3 complete!");

    setIsExaminerSpeaking(true);
    const closing =
      "Thank you for your responses. That's the end of the speaking test. Please allow me a moment to evaluate your progress.";
    console.log(`\n❓ EXAMINER SAYS: "${closing}"`);
    await speakAndWait(closing);
    setIsExaminerSpeaking(false);

    if (isExitingRef.current) {
      return;
    }

    console.log("\n➡️ Test Complete!\n");
    setWelcomePrompt("Evaluating your performance...");
    await waitFor(500);
    completeTest();
  };

  // ==================== TEST COMPLETION ====================

  const completeTest = async () => {
    if (isExitingRef.current) {
      return;
    }

    setPhase("complete");
    setIsEvaluating(true);

    const duration = Math.max(
      0,
      Math.round((Date.now() - testStartTime.current) / 1000)
    );
    console.log(
      `\n🎉 Test complete! Total duration: ${Math.floor(duration / 60)}:${(
        duration % 60
      )
        .toString()
        .padStart(2, "0")}`
    );

    const orderedResponses = [...responsesRef.current].sort((a, b) => {
      if (a.partNumber !== b.partNumber) {
        return a.partNumber - b.partNumber;
      }
      return a.questionIndex - b.questionIndex;
    });

    try {
      await Promise.all(transcriptionPromisesRef.current);
    } catch (error) {
      console.error("❌ Error waiting for transcriptions:", error);
    }

    orderedResponses.forEach((record) => {
      if (!record.transcript) {
        record.transcript = "";
      }
      if (record.durationSeconds === undefined) {
        record.durationSeconds = 0;
      }
    });

    const questionsPayload = buildQuestionPayload();
    const recordingsPayload: RecordingPayload[] = orderedResponses.map(
      (record) => ({
        partNumber: record.partNumber,
        questionIndex: record.questionIndex,
        transcript: record.transcript || "",
        durationSeconds: record.durationSeconds ?? 0,
        recordingUri: record.recordingUri,
      })
    );

    const evaluationRecordings = recordingsPayload.map(
      ({ recordingUri, ...rest }) => rest
    );

    let fullTranscript = buildFullTranscript(orderedResponses);
    if (!fullTranscript.trim().length) {
      fullTranscript =
        "Candidate did not provide verbal responses during the session.";
    }

    const metadataDifficulty = determineOverallDifficulty(questionsPayload);

    const evaluationPayload = {
      testSessionId: testSessionIdRef.current,
      fullTranscript,
      durationSeconds: duration,
      questions: questionsPayload,
      recordings: evaluationRecordings,
      metadata: {
        difficulty: metadataDifficulty,
        testStartedAt: new Date(testStartTime.current).toISOString(),
        testCompletedAt: new Date().toISOString(),
      },
    };

    try {
      const evaluationResponse = await evaluateFullTest(evaluationPayload);

      testSessionIdRef.current =
        evaluationResponse.testSessionId ||
        evaluationResponse.evaluation?.testSessionId ||
        testSessionIdRef.current;

      setIsEvaluating(false);

      if (isExitingRef.current) {
        return;
      }

      const summary =
        evaluationResponse.spokenSummary ||
        evaluationResponse.evaluation?.spokenSummary ||
        "";

      if (summary.trim().length > 0) {
        setWelcomePrompt(summary);
        setIsExaminerSpeaking(true);
        await speakAndWait(summary);
        setIsExaminerSpeaking(false);
        setWelcomePrompt(null);
      }

      setWelcomePrompt(null);

      if (isExitingRef.current) {
        return;
      }

      const normalizedCriteria = normalizeCriteria(
        evaluationResponse.evaluation?.criteria
      );
      const normalizedCorrections = normalizeCorrections(
        evaluationResponse.evaluation?.corrections
      );
      const normalizedPartScores = normalizePartScores(
        evaluationResponse.partScores ||
          evaluationResponse.evaluation?.partScores
      );

      onComplete({
        type: "authentic-full-test",
        timestamp: new Date().toISOString(),
        duration,
        fullTranscript,
        questions: questionsPayload,
        recordings: recordingsPayload,
        evaluation: evaluationResponse.evaluation
          ? {
              ...evaluationResponse.evaluation,
              overallBand: ensureNumber(
                evaluationResponse.evaluation.overallBand
              ),
              criteria: normalizedCriteria,
              corrections: normalizedCorrections,
              partScores: normalizedPartScores,
            }
          : undefined,
        overallBand: ensureNumber(
          evaluationResponse.overallBand ??
            evaluationResponse.evaluation?.overallBand
        ),
        partScores: normalizedPartScores,
        spokenSummary: ensureString(
          evaluationResponse.spokenSummary ??
            evaluationResponse.evaluation?.spokenSummary
        ),
        testSessionId: testSessionIdRef.current,
      });
    } catch (error) {
      console.error("❌ Full test evaluation failed:", error);
      setIsExaminerSpeaking(false);
      setWelcomePrompt(null);
      setIsEvaluating(false);

      if (!isExitingRef.current) {
        onComplete({
          type: "authentic-full-test",
          timestamp: new Date().toISOString(),
          duration,
          fullTranscript,
          questions: questionsPayload,
          recordings: recordingsPayload,
          testSessionId: testSessionIdRef.current,
        });
      }
    }
  };

  // ==================== RECORDING CONTROL ====================

  const toggleRecording = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const startRecording = async () => {
    try {
      console.log("\n🎤 START RECORDING");

      // Re-configure audio mode before recording (iOS requirement)
      console.log("🔧 Re-configuring audio mode for recording...");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      } as any);
      console.log("✅ Audio mode re-configured");

      // Create new recording
      console.log("📝 Creating recording...");
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      console.log("✅ Recording created successfully");

      recording.current = newRecording;
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerInterval.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      console.log("🔴 Recording started");
    } catch (error) {
      console.error("❌ Failed to start recording:", error);
      Alert.alert("Error", "Failed to start recording. Please try again.");
    }
  };

  const stopRecording = async () => {
    try {
      console.log("\n⏹️  STOP RECORDING");

      if (!recording.current) {
        console.warn("⚠️  No active recording");
        return;
      }

      // Stop timer
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }

      // Stop and save recording
      await recording.current.stopAndUnloadAsync();
      const uri = recording.current.getURI();

      recording.current = null;
      setIsRecording(false);

      if (!uri) {
        throw new Error("No recording URI");
      }

      console.log(`✅ Recording saved: ${uri}`);
      console.log(`⏱️  Duration: ${recordingTime}s`);
      console.log(`💬 [USER ANSWERED - Recording saved]`);

      const currentDuration = recordingTime;
      setRecordingTime(0);

      let responseRecord: ResponseRecord | null = null;

      if (phase === "part1") {
        const questionMeta = part1Questions[currentQuestionIndex];
        responseRecord = {
          partNumber: 1,
          questionIndex: currentQuestionIndex,
          questionId: questionMeta?.questionId,
          question: questionMeta?.question || "",
          category: "part1",
          difficulty: questionMeta?.difficulty,
          topic: questionMeta?.keywords?.[0],
          recordingUri: uri,
          durationSeconds: currentDuration,
        };
      } else if (phase === "part2-speaking") {
        const questionMeta = part2Topic;
        responseRecord = {
          partNumber: 2,
          questionIndex: 0,
          questionId: questionMeta?.questionId,
          question: questionMeta?.question || "",
          category: "part2",
          difficulty: questionMeta?.difficulty,
          topic: questionMeta?.cueCard?.mainTopic || questionMeta?.question,
          recordingUri: uri,
          durationSeconds: currentDuration,
        };
      } else if (phase === "part3") {
        const questionMeta = part3Questions[currentQuestionIndex];
        responseRecord = {
          partNumber: 3,
          questionIndex: currentQuestionIndex,
          questionId: questionMeta?.questionId,
          question: questionMeta?.question || "",
          category: "part3",
          difficulty: questionMeta?.difficulty,
          topic: questionMeta?.keywords?.[0],
          recordingUri: uri,
          durationSeconds: currentDuration,
        };
      }

      if (responseRecord) {
        responsesRef.current.push(responseRecord);
        enqueueTranscription(responseRecord, uri, currentDuration);
      }

      // Save to appropriate array
      if (phase === "part1") {
        part1Answers.current.push(uri);
        console.log(`💾 Saved Part 1 answer ${part1Answers.current.length}`);
        console.log(`\n➡️  Moving to next Part 1 question...\n`);

        // Move to next question
        const nextIndex = currentQuestionIndex + 1;
        setIsTransitioning(true);
        scheduleTimeout(() => {
          askPart1Question(nextIndex);
        }, 1500);
      } else if (phase === "part2-speaking") {
        part2Answer.current = uri;
        console.log(`💾 Saved Part 2 long turn`);
        console.log(`\n➡️  Part 2 complete, moving to Part 3...\n`);

        setIsTransitioning(true);
        finishPart2();
      } else if (phase === "part3") {
        part3Answers.current.push(uri);
        console.log(`💾 Saved Part 3 answer ${part3Answers.current.length}`);
        console.log(`\n➡️  Moving to next Part 3 question...\n`);

        // Move to next question
        const nextIndex = currentQuestionIndex + 1;
        setIsTransitioning(true);
        scheduleTimeout(() => {
          askPart3Question(nextIndex);
        }, 1500);
      }
    } catch (error) {
      console.error("❌ Failed to stop recording:", error);
      Alert.alert("Error", "Failed to save recording. Please try again.");
      setIsRecording(false);
    }
  };

  // ==================== TTS HELPER ====================

  const speakAndWait = async (text: string): Promise<void> => {
    if (isExitingRef.current) {
      return;
    }

    return new Promise((resolve) => {
      console.log(`🗣️  Examiner: "${text.substring(0, 50)}..."`);

      ttsService.speak(text, {
        onDone: () => {
          console.log("✅ Speech complete");
          resolve();
        },
        onStopped: () => {
          console.log("🛑 Speech stopped");
          resolve();
        },
        onError: (error) => {
          console.error("❌ TTS error:", error);
          resolve(); // Continue anyway
        },
      });
    });
  };

  // ==================== UI HELPERS ====================

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getPhaseDisplay = (): { title: string; subtitle: string } => {
    switch (phase) {
      case "loading":
        return { title: "Loading", subtitle: "Preparing your test..." };
      case "welcome":
        return {
          title: "Introduction",
          subtitle: "Welcome to the IELTS Speaking Test",
        };
      case "part1":
        return {
          title: "Part 1: Interview",
          subtitle: `Question ${currentQuestionIndex + 1} of ${
            part1Questions.length
          }`,
        };
      case "part2-intro":
        return {
          title: "Part 2: Long Turn",
          subtitle: "Listening to instructions...",
        };
      case "part2-prep":
        return {
          title: "Part 2: Preparation",
          subtitle: `Time remaining: ${prepTime}s`,
        };
      case "part2-speaking":
        return {
          title: "Part 2: Your Turn",
          subtitle: "Speak for 1-2 minutes",
        };
      case "part3":
        return {
          title: "Part 3: Discussion",
          subtitle: `Question ${currentQuestionIndex + 1} of ${
            part3Questions.length
          }`,
        };
      case "complete":
        return isEvaluating
          ? {
              title: "Evaluating",
              subtitle: "Please wait while we review your performance",
            }
          : { title: "Test Complete", subtitle: "Well done!" };
      default:
        return { title: "", subtitle: "" };
    }
  };

  const canRecord = (): boolean => {
    return (
      !isExaminerSpeaking &&
      !isTransitioning &&
      (phase === "part1" || phase === "part2-speaking" || phase === "part3")
    );
  };

  const getActiveQuestionContent = () => {
    if (isExaminerSpeaking) {
      return null;
    }

    if (phase === "welcome" && welcomePrompt) {
      return {
        label: "Examiner",
        text: welcomePrompt,
        bulletPoints: undefined,
      };
    }

    if (phase === "part1") {
      const question = part1Questions[currentQuestionIndex];
      if (!question?.question) {
        return null;
      }

      return {
        label: "Part 1 Question",
        text: question.question,
        bulletPoints: undefined,
      };
    }

    if (phase === "part2-prep" || phase === "part2-speaking") {
      if (!part2Topic?.question) {
        return null;
      }

      return {
        label: phase === "part2-prep" ? "Part 2 Topic" : "Part 2 Question",
        text: part2Topic.question,
        bulletPoints: part2Topic.cueCard?.bulletPoints ?? [],
      };
    }

    if (phase === "part3") {
      const question = part3Questions[currentQuestionIndex];
      if (!question?.question) {
        return null;
      }

      return {
        label: "Part 3 Question",
        text: question.question,
        bulletPoints: undefined,
      };
    }

    return null;
  };

  // ==================== RENDER ====================

  const { title, subtitle } = getPhaseDisplay();
  const activeQuestion = getActiveQuestionContent();

  if (phase === "loading") {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading Test...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === "complete" && !isEvaluating) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.completeContainer}>
          <Ionicons name="checkmark-circle" size={80} color={colors.success} />
          <Text style={styles.completeTitle}>Test Complete!</Text>
          <Text style={styles.completeSubtitle}>Preparing your results...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {/* Question prompt */}
      {activeQuestion && (
        <View style={styles.questionCard}>
          <Text style={styles.questionLabel}>{activeQuestion.label}</Text>
          <Text style={styles.questionText}>{activeQuestion.text}</Text>
          {activeQuestion.bulletPoints &&
          activeQuestion.bulletPoints.length > 0 ? (
            <View style={styles.cueList}>
              {activeQuestion.bulletPoints.map((point, index) => (
                <Text key={`${index}-${point}`} style={styles.cueItem}>
                  • {point}
                </Text>
              ))}
            </View>
          ) : null}
          {phase === "part2-prep" && (
            <Text style={styles.prepHint}>
              You have 1 minute to prepare your answer.
            </Text>
          )}
        </View>
      )}

      {/* Center - Mic Button or Status */}
      <View style={styles.centerContainer}>
        {isExaminerSpeaking || isTransitioning ? (
          <View style={styles.speakingContainer}>
            <Ionicons name="volume-high" size={60} color={colors.primary} />
            <Text style={styles.speakingText}>
              {isExaminerSpeaking
                ? "Examiner is speaking..."
                : "Please wait..."}
            </Text>
            <Text style={styles.speakingSubtext}>Please listen carefully</Text>
          </View>
        ) : phase === "complete" && isEvaluating ? (
          <View style={styles.evaluatingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.evaluatingText}>
              Evaluating your performance...
            </Text>
          </View>
        ) : phase === "part2-prep" ? (
          <View style={styles.prepContainer}>
            <Text style={styles.prepTime}>{prepTime}s</Text>
            <Text style={styles.prepText}>Preparation Time</Text>
            <Text style={styles.prepSubtext}>Think about your answer</Text>
          </View>
        ) : canRecord() ? (
          <View style={styles.recordContainer}>
            <TouchableOpacity
              style={[
                styles.micButton,
                isRecording && styles.micButtonRecording,
              ]}
              onPress={toggleRecording}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isRecording ? "stop" : "mic"}
                size={60}
                color="white"
              />
            </TouchableOpacity>

            {isRecording ? (
              <>
                <Text style={styles.recordingText}>Recording...</Text>
                <Text style={styles.recordingTime}>
                  {formatTime(recordingTime)}
                </Text>
                <Text style={styles.recordingHint}>Press again to stop</Text>
              </>
            ) : (
              <>
                <Text style={styles.readyText}>Press to Start Recording</Text>
                <Text style={styles.readyHint}>Answer the question above</Text>
              </>
            )}
          </View>
        ) : (
          <View style={styles.waitContainer}>
            <Ionicons
              name="time-outline"
              size={60}
              color={colors.textSecondary}
            />
            <Text style={styles.waitText}>Please wait...</Text>
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={handleExit} style={styles.exitButton}>
          <Text style={styles.exitButtonText}>Exit Test</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: spacing.lg,
    fontSize: 16,
    color: colors.textSecondary,
  },
  completeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  completeSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  header: {
    padding: spacing.lg,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  questionCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  questionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  questionText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  cueList: {
    marginTop: spacing.md,
  },
  cueItem: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  prepHint: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
  speakingContainer: {
    alignItems: "center",
  },
  speakingText: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  speakingSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  evaluatingContainer: {
    alignItems: "center",
  },
  evaluatingText: {
    marginTop: spacing.lg,
    fontSize: 16,
    color: colors.textSecondary,
  },
  prepContainer: {
    alignItems: "center",
  },
  prepTime: {
    fontSize: 64,
    fontWeight: "bold",
    color: colors.primary,
  },
  prepText: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  prepSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  recordContainer: {
    alignItems: "center",
  },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  micButtonRecording: {
    backgroundColor: colors.danger,
  },
  recordingText: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.danger,
    marginTop: spacing.lg,
  },
  recordingTime: {
    fontSize: 32,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  recordingHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  readyText: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  readyHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  waitContainer: {
    alignItems: "center",
  },
  waitText: {
    fontSize: 18,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  footer: {
    padding: spacing.lg,
    alignItems: "center",
  },
  exitButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  exitButtonText: {
    fontSize: 16,
    color: colors.danger,
    fontWeight: "600",
  },
});
