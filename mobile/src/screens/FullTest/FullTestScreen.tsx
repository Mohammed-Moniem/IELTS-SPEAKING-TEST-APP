import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  BackHandler,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GeneratedTopic, getCachedRandomTopic } from "../../api/topicApi";
import { VoiceOrb } from "../../components/VoiceOrb";
import { resultsStorage } from "../../services/resultsStorage";
import { ttsService } from "../../services/textToSpeechService";
import { colors, spacing } from "../../theme/tokens";

type TestState =
  | "intro"
  | "part1-examiner"
  | "part1-user"
  | "part1-complete"
  | "part2-intro"
  | "part2-prep"
  | "part2-examiner"
  | "part2-user"
  | "part2-complete"
  | "part3-intro"
  | "part3-examiner"
  | "part3-user"
  | "part3-complete"
  | "test-complete";

interface TestQuestion {
  part: 1 | 2 | 3;
  topic?: GeneratedTopic;
  currentQuestionIndex: number;
}

interface FullTestScreenProps {
  onComplete: (results: any) => void;
  onExit: () => void;
}

export const FullTestScreen: React.FC<FullTestScreenProps> = ({
  onComplete,
  onExit,
}) => {
  const [state, setState] = useState<TestState>("intro");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [timer, setTimer] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptMessage, setPromptMessage] = useState("");
  const promptOpacity = useRef(new Animated.Value(0)).current;

  // Test data storage
  const [part1Questions, setPart1Questions] = useState<GeneratedTopic[]>([]);
  const [part2Topic, setPart2Topic] = useState<GeneratedTopic | null>(null);
  const [part3Questions, setPart3Questions] = useState<GeneratedTopic[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<TestQuestion>({
    part: 1,
    currentQuestionIndex: 0,
  });

  // Audio recordings for each part
  const part1Recordings = useRef<string[]>([]);
  const part2Recording = useRef<string | null>(null);
  const part3Recordings = useRef<string[]>([]);

  // Timing refs
  const testStartTime = useRef<number>(Date.now());
  const partStartTime = useRef<number>(0);
  const recordingStartTime = useRef<number>(0);

  // Initialize test on mount
  useEffect(() => {
    initializeTest();
    setupBackHandler();

    return () => {
      cleanup();
    };
  }, []);

  const setupBackHandler = () => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handleExitAttempt();
        return true; // Prevent default back action
      }
    );

    return () => backHandler.remove();
  };

  const handleExitAttempt = () => {
    Alert.alert(
      "Exit Test?",
      "If you leave now, this test will not be evaluated and your progress will be lost. Are you sure you want to exit?",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Exit",
          style: "destructive",
          onPress: () => {
            cleanup();
            onExit();
          },
        },
      ]
    );
  };

  const cleanup = async () => {
    // Stop any ongoing TTS
    ttsService.stop();

    // Stop any recording
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
      } catch (error) {
        console.log("Recording cleanup error:", error);
      }
    }

    // Reset audio mode
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
      });
    } catch (error) {
      console.log("Audio mode reset error:", error);
    }
  };

  const initializeTest = async () => {
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Microphone Required",
          "This test requires microphone access to record your responses.",
          [{ text: "OK", onPress: onExit }]
        );
        return;
      }

      // Load all questions for the test
      const usedQuestions = await resultsStorage.getUsedQuestions();

      // Part 1: 4-5 follow-up questions
      const part1Qs = await Promise.all([
        getCachedRandomTopic("part1", "medium", usedQuestions),
        getCachedRandomTopic("part1", "medium", usedQuestions),
        getCachedRandomTopic("part1", "medium", usedQuestions),
        getCachedRandomTopic("part1", "medium", usedQuestions),
      ]);
      setPart1Questions(part1Qs);

      // Part 2: 1 topic with cue card
      const part2Q = await getCachedRandomTopic(
        "part2",
        "medium",
        usedQuestions
      );
      setPart2Topic(part2Q);

      // Part 3: 3-4 discussion questions
      const part3Qs = await Promise.all([
        getCachedRandomTopic("part3", "medium", usedQuestions),
        getCachedRandomTopic("part3", "medium", usedQuestions),
        getCachedRandomTopic("part3", "medium", usedQuestions),
      ]);
      setPart3Questions(part3Qs);

      // Mark all questions as used
      for (const q of part1Qs) {
        await resultsStorage.markQuestionAsUsed(q.question, 1);
      }
      await resultsStorage.markQuestionAsUsed(part2Q.question, 2);
      for (const q of part3Qs) {
        await resultsStorage.markQuestionAsUsed(q.question, 3);
      }

      // Start the test
      startIntroduction();
    } catch (error) {
      console.error("Failed to initialize test:", error);
      Alert.alert("Error", "Failed to load test questions. Please try again.", [
        { text: "OK", onPress: onExit },
      ]);
    }
  };

  const startIntroduction = async () => {
    setState("intro");

    // Configure audio for loudspeaker playback
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: false,
    });

    // Speak welcome message
    const welcome =
      "Good morning. Good afternoon. I'm your examiner for today's IELTS Speaking test. Can you tell me your full name, please?";

    await ttsService.speak(welcome, {
      onDone: () => {
        // After examiner speaks, prompt user to respond
        showTimedPrompt("Speak now", 2000);
        startPart1Introduction();
      },
    });
  };

  const startPart1Introduction = async () => {
    setState("part1-examiner");
    partStartTime.current = Date.now();

    // Speak Part 1 introduction
    const intro =
      "In this part, I'd like to ask you some general questions about yourself and a range of familiar topics. Let's begin.";

    await ttsService.speak(intro, {
      onDone: () => {
        // Start asking Part 1 questions
        askNextPart1Question();
      },
    });
  };

  const askNextPart1Question = async () => {
    const questionIndex = currentQuestion.currentQuestionIndex;

    if (questionIndex >= part1Questions.length) {
      // Part 1 complete
      completePart1();
      return;
    }

    const question = part1Questions[questionIndex];
    setState("part1-examiner");

    await ttsService.speak(question.question, {
      onDone: async () => {
        // Prompt user to speak
        setState("part1-user");
        showTimedPrompt("Your turn to speak", 1500);

        // Configure for recording
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          playThroughEarpieceAndroid: false,
        });

        // Start recording automatically after a short delay
        setTimeout(() => {
          startRecording("part1");
        }, 1500);
      },
    });
  };

  const startRecording = async (part: "part1" | "part2" | "part3") => {
    try {
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      recordingStartTime.current = Date.now();

      // Set appropriate time limit based on part
      let timeLimit = 60; // Default 60 seconds per response
      if (part === "part2") {
        timeLimit = 120; // 2 minutes for Part 2 monologue
      }

      // Auto-stop after time limit
      setTimeout(() => {
        if (recording) {
          stopRecording(part);
        }
      }, timeLimit * 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  };

  const stopRecording = async (part: "part1" | "part2" | "part3") => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        // Save recording based on part
        if (part === "part1") {
          part1Recordings.current.push(uri);
          // Move to next question
          setCurrentQuestion((prev) => ({
            ...prev,
            currentQuestionIndex: prev.currentQuestionIndex + 1,
          }));
          // Small delay before next question
          setTimeout(() => {
            askNextPart1Question();
          }, 1000);
        } else if (part === "part2") {
          part2Recording.current = uri;
          completePart2();
        } else if (part === "part3") {
          part3Recordings.current.push(uri);
          // Move to next question
          setCurrentQuestion((prev) => ({
            ...prev,
            currentQuestionIndex: prev.currentQuestionIndex + 1,
          }));
          setTimeout(() => {
            askNextPart3Question();
          }, 1000);
        }
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
    }
  };

  const completePart1 = async () => {
    setState("part1-complete");

    const closing = "Thank you. That's the end of Part 1.";
    await ttsService.speak(closing, {
      onDone: () => {
        // Brief pause before Part 2
        setTimeout(() => {
          startPart2();
        }, 2000);
      },
    });
  };

  const startPart2 = async () => {
    setState("part2-intro");
    setCurrentQuestion({ part: 2, currentQuestionIndex: 0 });
    partStartTime.current = Date.now();

    const intro =
      "Now, I'm going to give you a topic and I'd like you to talk about it for one to two minutes. Before you talk, you'll have one minute to think about what you're going to say. You can make some notes if you wish. Here is your topic.";

    await ttsService.speak(intro, {
      onDone: async () => {
        // Read the cue card
        if (part2Topic) {
          await ttsService.speak(part2Topic.question, {
            onDone: () => {
              // Start preparation timer
              startPart2Preparation();
            },
          });
        }
      },
    });
  };

  const startPart2Preparation = () => {
    setState("part2-prep");
    showTimedPrompt("1 minute to prepare", 3000);

    let prepTime = 0;
    const prepInterval = setInterval(() => {
      prepTime++;
      if (prepTime >= 60) {
        clearInterval(prepInterval);
        startPart2Speaking();
      }
    }, 1000);
  };

  const startPart2Speaking = async () => {
    setState("part2-examiner");

    const prompt =
      "Alright, remember you have one to two minutes for this. I'll tell you when the time is up. Please begin speaking now.";
    await ttsService.speak(prompt, {
      onDone: () => {
        setState("part2-user");
        showTimedPrompt("Speak for 1-2 minutes", 2000);

        // Configure for recording
        Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          playThroughEarpieceAndroid: false,
        });

        setTimeout(() => {
          startRecording("part2");
        }, 1500);
      },
    });
  };

  const completePart2 = async () => {
    setState("part2-complete");

    const closing = "Thank you. That's the end of Part 2.";
    await ttsService.speak(closing, {
      onDone: () => {
        setTimeout(() => {
          startPart3();
        }, 2000);
      },
    });
  };

  const startPart3 = async () => {
    setState("part3-intro");
    setCurrentQuestion({ part: 3, currentQuestionIndex: 0 });
    partStartTime.current = Date.now();

    const intro =
      "We've been talking about your topic, and I'd like to discuss some more general questions related to this. Let's consider some broader issues.";

    await ttsService.speak(intro, {
      onDone: () => {
        askNextPart3Question();
      },
    });
  };

  const askNextPart3Question = async () => {
    const questionIndex = currentQuestion.currentQuestionIndex;

    if (questionIndex >= part3Questions.length) {
      completeTest();
      return;
    }

    const question = part3Questions[questionIndex];
    setState("part3-examiner");

    await ttsService.speak(question.question, {
      onDone: async () => {
        setState("part3-user");
        showTimedPrompt("Your turn to speak", 1500);

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          playThroughEarpieceAndroid: false,
        });

        setTimeout(() => {
          startRecording("part3");
        }, 1500);
      },
    });
  };

  const completeTest = async () => {
    setState("test-complete");

    const closing =
      "Thank you. That's the end of the speaking test. We'll send your results shortly.";
    await ttsService.speak(closing, {
      onDone: () => {
        // Process and send results
        processTestResults();
      },
    });
  };

  const processTestResults = () => {
    const totalDuration = Math.round(
      (Date.now() - testStartTime.current) / 1000
    );

    const results = {
      part1: {
        recordings: part1Recordings.current,
        questions: part1Questions,
        duration: totalDuration, // Will be calculated properly
      },
      part2: {
        recording: part2Recording.current,
        topic: part2Topic,
        duration: totalDuration,
      },
      part3: {
        recordings: part3Recordings.current,
        questions: part3Questions,
        duration: totalDuration,
      },
      totalDuration,
      completedAt: new Date().toISOString(),
    };

    onComplete(results);
  };

  const showTimedPrompt = (message: string, duration: number) => {
    setPromptMessage(message);
    setShowPrompt(true);

    Animated.sequence([
      Animated.timing(promptOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(duration - 600),
      Animated.timing(promptOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowPrompt(false);
    });
  };

  // Timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      if (state.includes("user") && recording) {
        setTimer((prev) => prev + 1);
      } else {
        setTimer(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state, recording]);

  const getStatusMessage = (): string => {
    if (state === "intro") return "Welcome";
    if (state.includes("part1")) return "Part 1: Introduction & Interview";
    if (state.includes("part2")) return "Part 2: Individual Long Turn";
    if (state.includes("part3")) return "Part 3: Two-way Discussion";
    if (state === "test-complete") return "Test Complete";
    return "IELTS Speaking Test";
  };

  const getSubMessage = (): string => {
    if (state.includes("examiner")) return "Examiner speaking...";
    if (state.includes("user"))
      return recording ? "You are speaking..." : "Listening...";
    if (state.includes("prep")) return "Preparation time...";
    if (state.includes("complete")) return "Moving to next part...";
    return "";
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleExitAttempt} style={styles.exitButton}>
          <Ionicons name="close" size={24} color={colors.textInverse} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{getStatusMessage()}</Text>
          <Text style={styles.headerSubtitle}>{getSubMessage()}</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Main content */}
      <View style={styles.content}>
        <VoiceOrb
          isListening={recording !== null}
          isSpeaking={state.includes("examiner")}
        />

        {/* Timer */}
        {recording && (
          <View style={styles.timerContainer}>
            <View style={styles.timerDot} />
            <Text style={styles.timerText}>{formatTime(timer)}</Text>
          </View>
        )}

        {/* Current question display */}
        {currentQuestion.part === 1 &&
          part1Questions[currentQuestion.currentQuestionIndex] && (
            <View style={styles.questionCard}>
              <Text style={styles.questionText}>
                {part1Questions[currentQuestion.currentQuestionIndex].question}
              </Text>
            </View>
          )}

        {currentQuestion.part === 2 &&
          part2Topic &&
          state.includes("part2") && (
            <View style={styles.questionCard}>
              <Text style={styles.partLabel}>Part 2 Topic</Text>
              <Text style={styles.questionText}>{part2Topic.question}</Text>
              {state === "part2-prep" && (
                <Text style={styles.prepText}>
                  You have 1 minute to prepare
                </Text>
              )}
            </View>
          )}

        {currentQuestion.part === 3 &&
          part3Questions[currentQuestion.currentQuestionIndex] && (
            <View style={styles.questionCard}>
              <Text style={styles.questionText}>
                {part3Questions[currentQuestion.currentQuestionIndex].question}
              </Text>
            </View>
          )}
      </View>

      {/* Prompt overlay */}
      {showPrompt && (
        <Animated.View
          style={[styles.promptOverlay, { opacity: promptOpacity }]}
        >
          <View style={styles.promptBadge}>
            <Ionicons name="mic" size={16} color={colors.textInverse} />
            <Text style={styles.promptText}>{promptMessage}</Text>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    backgroundColor: colors.primary,
  },
  exitButton: {
    padding: spacing.xs,
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  placeholder: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textInverse,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textInverse,
    opacity: 0.8,
    marginTop: 2,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xl,
    padding: spacing.sm,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 20,
  },
  timerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
    marginRight: spacing.xs,
  },
  timerText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  questionCard: {
    position: "absolute",
    bottom: spacing.xxl,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  partLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  questionText: {
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 24,
  },
  prepText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontStyle: "italic",
  },
  promptOverlay: {
    position: "absolute",
    top: 100,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  promptBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  promptText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textInverse,
    marginLeft: spacing.xs,
  },
});
