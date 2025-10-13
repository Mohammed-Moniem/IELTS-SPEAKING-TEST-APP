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
import { GeneratedTopic, getCachedRandomTopic, topicCache } from "../api/topicApi";
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

export const AuthenticFullTestV2: React.FC<TestProps> = ({
  onComplete,
  onExit,
}) => {
  // Test state
  const [phase, setPhase] = useState<TestPhase>("loading");
  const [isRecording, setIsRecording] = useState(false);
  const [isExaminerSpeaking, setIsExaminerSpeaking] = useState(false);

  // Questions
  const [part1Questions, setPart1Questions] = useState<GeneratedTopic[]>([]);
  const [part2Topic, setPart2Topic] = useState<GeneratedTopic | null>(null);
  const [part3Questions, setPart3Questions] = useState<GeneratedTopic[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionsReady, setQuestionsReady] = useState(false);

  // Recordings
  const recording = useRef<Audio.Recording | null>(null);
  const part1Answers = useRef<string[]>([]);
  const part2Answer = useRef<string | null>(null);
  const part3Answers = useRef<string[]>([]);

  // Timing
  const [recordingTime, setRecordingTime] = useState(0);
  const [prepTime, setPrepTime] = useState(60); // 60 seconds prep for Part 2
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const testStartTime = useRef<number>(0);

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
      cleanup();
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
      });
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

  const cleanup = () => {
    if (recording.current) {
      recording.current.stopAndUnloadAsync().catch(() => {});
    }
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
    }
  };

  const handleExit = () => {
    Alert.alert("Exit Test?", "Your progress will not be saved.", [
      { text: "Cancel", style: "cancel" },
      { text: "Exit", onPress: onExit, style: "destructive" },
    ]);
  };

  // ==================== PART 1: INTRODUCTION (4-5 minutes) ====================

  const startWelcome = async () => {
    setPhase("welcome");
    setIsExaminerSpeaking(true);

    const welcome =
      "Good morning. My name is Dr. Smith and I will be your examiner today. Can you tell me your full name please?";

    await speakAndWait(welcome);

    setIsExaminerSpeaking(false);

    // Pause, then start Part 1
    setTimeout(() => {
      startPart1();
    }, 2000);
  };

  const startPart1 = async () => {
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
    setCurrentQuestionIndex(0);
    askPart1Question(0);
  };

  const askPart1Question = async (index: number) => {
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
                askPart1Question(index + 1);
              } else {
                finishPart1();
              }
            },
          },
        ]
      );
      return;
    }

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
    console.log("\n✅ Part 1 complete!");

    setIsExaminerSpeaking(true);
    const transition =
      "Thank you. That's the end of Part 1. Now let's move on to Part 2.";
    await speakAndWait(transition);
    setIsExaminerSpeaking(false);

    setTimeout(() => {
      startPart2();
    }, 2000);
  };

  // ==================== PART 2: LONG TURN (3-4 minutes) ====================

  const startPart2 = async () => {
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
          setTimeout(() => {
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
    console.log("\n✅ Part 2 complete!");

    setIsExaminerSpeaking(true);
    const transition =
      "Thank you. Now we'll move on to Part 3, where I'll ask you some more abstract questions.";
    console.log(`\n❓ EXAMINER SAYS: "${transition}"`);
    await speakAndWait(transition);
    setIsExaminerSpeaking(false);

    console.log("\n➡️ Moving to Part 3...\n");
    setTimeout(() => {
      startPart3();
    }, 2000);
  };

  // ==================== PART 3: DISCUSSION (4-5 minutes) ====================

  const startPart3 = () => {
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
                askPart3Question(index + 1);
              } else {
                finishPart3();
              }
            },
          },
        ]
      );
      return;
    }

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
    console.log("\n✅ Part 3 complete!");

    setIsExaminerSpeaking(true);
    const closing =
      "Thank you very much. That's the end of the speaking test. You may leave now.";
    console.log(`\n❓ EXAMINER SAYS: "${closing}"`);
    await speakAndWait(closing);
    setIsExaminerSpeaking(false);

    console.log("\n➡️ Test Complete!\n");
    setTimeout(() => {
      completeTest();
    }, 2000);
  };

  // ==================== TEST COMPLETION ====================

  const completeTest = async () => {
    setPhase("complete");

    const duration = Math.round((Date.now() - testStartTime.current) / 1000);
    console.log(
      `\n🎉 Test complete! Total duration: ${Math.floor(duration / 60)}:${(
        duration % 60
      )
        .toString()
        .padStart(2, "0")}`
    );

    // Prepare results
    const results = {
      type: "authentic-full-test",
      timestamp: new Date().toISOString(),
      duration,
      part1Recordings: part1Answers.current,
      part2Recording: part2Answer.current,
      part3Recordings: part3Answers.current,
    };

    console.log("💾 Results:", results);

    // Call completion callback
    setTimeout(() => {
      onComplete(results);
    }, 3000);
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
      });
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

      // Save to appropriate array
      if (phase === "part1") {
        part1Answers.current.push(uri);
        console.log(`💾 Saved Part 1 answer ${part1Answers.current.length}`);
        console.log(`\n➡️  Moving to next Part 1 question...\n`);

        // Move to next question
        const nextIndex = currentQuestionIndex + 1;
        setCurrentQuestionIndex(nextIndex);

        setTimeout(() => {
          askPart1Question(nextIndex);
        }, 1500);
      } else if (phase === "part2-speaking") {
        part2Answer.current = uri;
        console.log(`💾 Saved Part 2 long turn`);
        console.log(`\n➡️  Part 2 complete, moving to Part 3...\n`);

        finishPart2();
      } else if (phase === "part3") {
        part3Answers.current.push(uri);
        console.log(`💾 Saved Part 3 answer ${part3Answers.current.length}`);
        console.log(`\n➡️  Moving to next Part 3 question...\n`);

        // Move to next question
        const nextIndex = currentQuestionIndex + 1;
        setCurrentQuestionIndex(nextIndex);

        setTimeout(() => {
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
    return new Promise((resolve) => {
      console.log(`🗣️  Examiner: "${text.substring(0, 50)}..."`);

      ttsService.speak(text, {
        onDone: () => {
          console.log("✅ Speech complete");
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
        return { title: "Test Complete", subtitle: "Well done!" };
      default:
        return { title: "", subtitle: "" };
    }
  };

  const canRecord = (): boolean => {
    return (
      !isExaminerSpeaking &&
      (phase === "part1" || phase === "part2-speaking" || phase === "part3")
    );
  };

  // ==================== RENDER ====================

  const { title, subtitle } = getPhaseDisplay();

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

  if (phase === "complete") {
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

      {/* Center - Mic Button or Status */}
      <View style={styles.centerContainer}>
        {isExaminerSpeaking ? (
          <View style={styles.speakingContainer}>
            <Ionicons name="volume-high" size={60} color={colors.primary} />
            <Text style={styles.speakingText}>Examiner is speaking...</Text>
            <Text style={styles.speakingSubtext}>Please listen carefully</Text>
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
