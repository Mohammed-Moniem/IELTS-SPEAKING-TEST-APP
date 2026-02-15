import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { evaluateResponse, processConversationTurn } from "../api/speechApi";
import { GeneratedTopic, getRandomTopic } from "../api/topicApi";
import { ttsService } from "../services/textToSpeechService";
import { VoiceOrb } from "./VoiceOrb";
import { Button } from "./Button";
import { colors, radii, shadows, spacing } from "../theme/tokens";

type TestPart = "part1" | "part2" | "part3";
type SimulationState =
  | "intro"
  | "part1"
  | "part2-prep"
  | "part2-speak"
  | "part3"
  | "complete";

interface SimulationModeProps {
  onEnd: (evaluationData?: any) => void;
}

export const SimulationMode: React.FC<SimulationModeProps> = ({ onEnd }) => {
  // State management
  const [currentState, setCurrentState] = useState<SimulationState>("intro");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);

  // Topic and conversation state
  const [part1Topic, setPart1Topic] = useState<GeneratedTopic | null>(null);
  const [part2Topic, setPart2Topic] = useState<GeneratedTopic | null>(null);
  const [part3Topic, setPart3Topic] = useState<GeneratedTopic | null>(null);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: "system" | "user" | "assistant"; content: string }>
  >([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [introInProgress, setIntroInProgress] = useState(false);
  const [promptMessage, setPromptMessage] = useState(
    "Tap Begin Test when you're ready."
  );

  // Timer state
  const [partTimer, setPartTimer] = useState(0); // Seconds elapsed in current part
  const [prepTimer, setPrepTimer] = useState(60); // Countdown for Part 2 preparation
  const [isPrepTimerRunning, setIsPrepTimerRunning] = useState(false);

  // Part time limits (in seconds)
  const PART1_DURATION = 4 * 60; // 4 minutes
  const PART2_SPEAK_DURATION = 2 * 60; // 2 minutes speaking
  const PART3_DURATION = 4 * 60; // 4 minutes

  // Initialize audio permissions
  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Microphone access is required for this test."
        );
        onEnd();
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    })();
  }, []);

  useEffect(() => {
    return () => {
      ttsService.stop();
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, [recording]);

  // Load topics when starting each part
  useEffect(() => {
    if (currentState === "part1" && !part1Topic) {
      loadPart1Topic();
    } else if (currentState === "part2-prep" && !part2Topic) {
      loadPart2Topic();
    } else if (currentState === "part3" && !part3Topic) {
      loadPart3Topic();
    }
  }, [currentState]);

  // Timer effect for part duration
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (
      currentState === "part1" ||
      currentState === "part2-speak" ||
      currentState === "part3"
    ) {
      interval = setInterval(() => {
        setPartTimer((prev) => {
          const newTime = prev + 1;

          // Check if time limit reached
          if (currentState === "part1" && newTime >= PART1_DURATION) {
            handleTimeExpired("part1");
          } else if (
            currentState === "part2-speak" &&
            newTime >= PART2_SPEAK_DURATION
          ) {
            handleTimeExpired("part2");
          } else if (currentState === "part3" && newTime >= PART3_DURATION) {
            handleTimeExpired("part3");
          }

          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentState, partTimer]);

  useEffect(() => {
    if (currentState === "intro") {
      setPromptMessage("Tap Begin Test when you're ready.");
    } else if (currentState === "complete") {
      setPromptMessage("Processing your full test results...");
    }
  }, [currentState]);

  useEffect(() => {
    if (currentState === "part2-prep") {
      setPromptMessage(`Preparation time remaining: ${formatTime(prepTimer)}`);
    }
  }, [currentState, prepTimer]);

  // Preparation timer for Part 2
  useEffect(() => {
    if (currentState !== "part2-prep" || !isPrepTimerRunning) {
      return;
    }

    const interval = setInterval(() => {
      setPrepTimer((prev) => {
        if (prev <= 1) {
          setIsPrepTimerRunning(false);
          setCurrentState("part2-speak");
          setPartTimer(0);
          handlePart2SpeakingStart();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentState, isPrepTimerRunning]);

  // Load topics from backend
  const loadPart1Topic = async (): Promise<GeneratedTopic | null> => {
    try {
      const topic = await getRandomTopic("part1", "medium");
      setPart1Topic(topic);
      setCurrentQuestion(topic.question);
      return topic;
    } catch (error) {
      console.error("Failed to load Part 1 topic:", error);
      Alert.alert(
        "Connection Error",
        "Failed to load test questions. Please check your connection."
      );
      onEnd();
      return null;
    }
  };

  const loadPart2Topic = async (): Promise<GeneratedTopic | null> => {
    try {
      const topic = await getRandomTopic("part2", "medium");
      setPart2Topic(topic);
      setCurrentQuestion(topic.question);
      return topic;
    } catch (error) {
      console.error("Failed to load Part 2 topic:", error);
      Alert.alert("Error", "Failed to load Part 2 topic.");
      return null;
    }
  };

  const loadPart3Topic = async (): Promise<GeneratedTopic | null> => {
    try {
      const topic = await getRandomTopic("part3", "medium");
      setPart3Topic(topic);
      setCurrentQuestion(topic.question);
      return topic;
    } catch (error) {
      console.error("Failed to load Part 3 topic:", error);
      Alert.alert("Error", "Failed to load Part 3 topic.");
      return null;
    }
  };

  const ensureTopicForPart = async (
    part: TestPart
  ): Promise<GeneratedTopic | null> => {
    if (part === "part1") {
      return part1Topic ?? (await loadPart1Topic());
    }
    if (part === "part2") {
      return part2Topic ?? (await loadPart2Topic());
    }
    return part3Topic ?? (await loadPart3Topic());
  };

  const buildSystemPrompt = (
    part: TestPart,
    topic: GeneratedTopic
  ): string => {
    const joinedKeywords = topic.keywords?.join(", ") || "the topic";

    if (part === "part1") {
      return `You are an official IELTS Speaking examiner conducting Part 1 (Introduction & Interview). Use a professional, encouraging tone. Ask short questions about familiar topics such as ${joinedKeywords}. Respond naturally to the candidate's answers, asking relevant follow-ups and clarifying questions. Keep Part 1 to around 4-5 minutes (about 4-5 questions) and politely manage the time if the candidate speaks for too long.`;
    }

    if (part === "part2") {
      return `You are an IELTS Speaking examiner listening to the candidate's Part 2 long turn on "${topic.cueCard?.mainTopic || topic.question}". Allow them to speak without interruptions for up to 2 minutes. When they finish, ask 1-2 concise follow-up questions based directly on what they said.`;
    }

    return `You are an IELTS Speaking examiner conducting Part 3. Continue the discussion about ${joinedKeywords}, asking analytical, opinion-based questions. Refer back to the candidate's earlier answers, challenge them to justify ideas, and manage the conversation naturally. Keep Part 3 moving with polite interruptions when necessary.`;
  };

  const getFirstQuestionForPart = (
    part: TestPart,
    topic: GeneratedTopic
  ): string => {
    if (part === "part1") {
      return topic.question;
    }
    if (part === "part3") {
      return topic.question;
    }
    return "";
  };

  const speakSequence = async (lines: string[], gapMs: number = 350) => {
    for (const line of lines) {
      if (!line || !line.trim()) continue;
      await speakAIResponse(line.trim());
      if (gapMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, gapMs));
      }
    }
  };

  const beginCandidateTurn = async (part: TestPart) => {
    await startRecording(true);
  };

  const initializePartConversation = async (
    part: TestPart,
    initialQuestion?: string
  ): Promise<{ topic: GeneratedTopic; firstQuestion?: string } | null> => {
    const topic = await ensureTopicForPart(part);
    if (!topic) {
      return null;
    }

    const systemPrompt = buildSystemPrompt(part, topic);
    const assistantQuestion =
      initialQuestion ||
      (part === "part1" || part === "part3"
        ? getFirstQuestionForPart(part, topic)
        : undefined);

    const history: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [{ role: "system", content: systemPrompt }];

    if (assistantQuestion) {
      history.push({ role: "assistant", content: assistantQuestion });
      setCurrentQuestion(assistantQuestion);
    } else {
      setCurrentQuestion(
        part === "part2"
          ? topic.cueCard?.mainTopic || topic.question
          : topic.question
      );
    }

    setConversationHistory(history);

    return { topic, firstQuestion: assistantQuestion };
  };

  const handleBeginTest = async () => {
    if (introInProgress || isProcessing || isAISpeaking) {
      return;
    }

    setIntroInProgress(true);
    try {
      const result = await initializePartConversation("part1");
      if (!result) {
        return;
      }

      const { topic, firstQuestion } = result;
      const focusArea = topic.keywords?.[0] || "you";
      const introScript = [
        "Good morning. My name is Examiner Smith, and I'll be conducting your IELTS Speaking test today.",
        "Could you please tell me your full name?",
        "Thank you. May I see the identification you used to register for this test?",
        `Great, thank you. Let's begin Part 1. I'd like to ask you some questions about ${focusArea}.`,
      ];

      await speakSequence(introScript);

      if (firstQuestion) {
        await speakAIResponse(firstQuestion);
      }

      setPartTimer(0);
      setCurrentState("part1");
      await beginCandidateTurn("part1");
    } catch (error) {
      console.error("Failed to start simulation:", error);
      Alert.alert(
        "Error",
        "Unable to start the full simulation. Please try again in a moment."
      );
    } finally {
      setIntroInProgress(false);
    }
  };

  const handlePart2SpeakingStart = async () => {
    const result = await initializePartConversation("part2");
    if (!result) {
      return;
    }

    await speakSequence([
      "Thank you. That's one minute.",
      "Please begin speaking now. I'll stop you after two minutes.",
    ]);
    setCurrentState("part2-speak");
    setPartTimer(0);
    await beginCandidateTurn("part2");
  };

  const transitionToPart2 = async () => {
    const topic = await ensureTopicForPart("part2");
    if (!topic) {
      return;
    }

    const cueCard = topic.cueCard;

    setCurrentState("part2-prep");
    setPrepTimer(cueCard?.preparationTime || 60);
    setPartTimer(0);
    setIsPrepTimerRunning(false);
    setCurrentQuestion(cueCard?.mainTopic || topic.question);

    const prepScript = [
      "Now we will move on to Part 2.",
      "I'm going to give you a topic and I'd like you to talk about it for one to two minutes.",
      "Before you speak, you have one minute to prepare. You can make notes on the paper in front of you.",
      `Here is your topic: ${cueCard?.mainTopic || topic.question}.`,
    ];

    await speakSequence(prepScript);

    if (cueCard?.bulletPoints?.length) {
      const pointers = cueCard.bulletPoints.map(
        (point) => `You should talk about: ${point}.`
      );
      await speakSequence(pointers, 250);
    }

    await speakAIResponse(
      "You may begin preparing now. I will tell you when it is time to start speaking."
    );

    setIsPrepTimerRunning(true);
  };

  const transitionToPart3 = async () => {
    const result = await initializePartConversation("part3");
    if (!result) {
      return;
    }

    const { topic, firstQuestion } = result;
    setPartTimer(0);
    setCurrentState("part3");
    setIsPrepTimerRunning(false);

    const theme = topic.keywords?.[0] || "this topic";
    const script = [
      "Thank you. That is the end of Part 2.",
      `Now let's move on to Part 3. I'd like to discuss some more general questions about ${theme}.`,
    ];

    if (firstQuestion) {
      script.push(firstQuestion);
    }

    await speakSequence(script);
    await beginCandidateTurn("part3");
  };

  // Handle time expiration for each part
  const handleTimeExpired = async (part: TestPart) => {
    // Stop any recording
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
        setRecording(null);
        setIsRecording(false);
      } catch (error) {
        console.error("Error stopping recording:", error);
      }
    }

    // AI interrupts politely
    if (part === "part1") {
      await speakAIResponse(
        "Thank you. That's the end of Part 1. Let's move to Part 2."
      );
      await transitionToPart2();
    } else if (part === "part2") {
      setIsPrepTimerRunning(false);
      await speakAIResponse(
        "Thank you. That's the end of Part 2. Now let's discuss this topic in more detail in Part 3."
      );
      await transitionToPart3();
    } else if (part === "part3") {
      await speakAIResponse(
        "Thank you very much. That concludes the speaking test."
      );
      await completeTest();
    }
  };

  // Speak AI response with TTS
  const speakAIResponse = async (text: string): Promise<void> => {
    const trimmed = text?.trim();
    if (!trimmed) {
      return;
    }

    setPromptMessage("Examiner speaking...");
    setIsAISpeaking(true);
    try {
      await ttsService.speak(trimmed);
    } catch (error) {
      console.error("TTS Error:", error);
    } finally {
      setIsAISpeaking(false);
    }
  };

  // Start recording
  const startRecording = async (force: boolean = false) => {
    try {
      if ((isAISpeaking || isProcessing) && !force) return;
      if (isRecording) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setIsRecording(true);
      setPromptMessage("Speak now. Tap anywhere when you're finished.");
    } catch (error) {
      console.error("Failed to start recording:", error);
      Alert.alert("Error", "Failed to start recording. Please try again.");
      setPromptMessage("We couldn't start recording. Please try again.");
    }
  };

  // Stop recording and process
  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      setPromptMessage("Processing your answer...");
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        await processUserResponse(uri);
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
      setPromptMessage("Something went wrong stopping the recording.");
    }
  };

  // Process user's response
  const processUserResponse = async (audioUri: string) => {
    setIsProcessing(true);
    setPromptMessage("Processing your answer...");

    try {
      const part: 1 | 2 | 3 =
        currentState === "part1" ? 1 : currentState === "part2-speak" ? 2 : 3;
      const conversationPart: TestPart =
        part === 1 ? "part1" : part === 2 ? "part2" : "part3";

      const result = await processConversationTurn(
        audioUri,
        conversationHistory,
        part,
        {
          topic: currentQuestion,
          timeRemaining:
            part === 1
              ? PART1_DURATION - partTimer
              : part === 2
              ? PART2_SPEAK_DURATION - partTimer
              : PART3_DURATION - partTimer,
        }
      );

      // Update conversation history
      const updatedHistory = [
        ...conversationHistory,
        { role: "user" as const, content: result.userTranscript },
        { role: "assistant" as const, content: result.examinerResponse },
      ];

      setConversationHistory(updatedHistory);
      setCurrentQuestion(result.examinerResponse);

      await speakAIResponse(result.examinerResponse);

      const activeState = currentState;
      const shouldResume =
        (conversationPart === "part1" && activeState === "part1") ||
        (conversationPart === "part2" && activeState === "part2-speak") ||
        (conversationPart === "part3" && activeState === "part3");

      if (shouldResume) {
        await beginCandidateTurn(conversationPart);
        setIsProcessing(false);
        return;
      }

      if (!isAISpeaking) {
        setPromptMessage("Waiting for the examiner...");
      }
    } catch (error) {
      console.error("Error processing response:", error);
      Alert.alert(
        "Error",
        "Failed to process your response. Please try again."
      );
      setPromptMessage("We couldn't process that. Please try again.");
    }
    setIsProcessing(false);
  };

  // Complete test and get evaluation
  const completeTest = async () => {
    setCurrentState("complete");
    setIsProcessing(true);
    setPromptMessage("Processing your full test results...");

    try {
      // Get comprehensive evaluation for full test
      const fullTranscript = conversationHistory
        .filter((msg) => msg.role === "user")
        .map((msg) => msg.content)
        .join(" ");

      const evaluation = await evaluateResponse(
        fullTranscript,
        "Full IELTS Speaking Test (All 3 Parts)",
        3 // Use Part 3 as representative of full test
      );

      onEnd(evaluation);
    } catch (error) {
      console.error("Error getting evaluation:", error);
      Alert.alert(
        "Error",
        "Failed to generate evaluation. Returning to main menu."
      );
      onEnd();
    } finally {
      setIsProcessing(false);
    }
  };

  // Format timer display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get orb props based on state
  const getOrbProps = () => {
    return {
      isListening: isRecording,
      isSpeaking: isAISpeaking,
    };
  };

  // Render intro screen
  const renderIntro = () => (
    <View style={styles.centerContainer}>
      <View style={styles.introContent}>
        <View style={styles.introHeader}>
          <Text style={styles.title}>IELTS Speaking Test</Text>
          <Text style={styles.subtitle}>Full Simulation Mode</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Test Structure</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>Part 1</Text>
            <Text style={styles.infoText}>
              Introduction & Interview · approximately 4 to 5 minutes
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>Part 2</Text>
            <Text style={styles.infoText}>
              Individual Long Turn with 1 minute preparation and 2 minutes of
              speaking
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>Part 3</Text>
            <Text style={styles.infoText}>
              Two-way Discussion building on Part 2 · approximately 4 to 5
              minutes
            </Text>
          </View>
        </View>

        <View style={styles.warningRow}>
          <Ionicons name="alert-circle" size={18} color={colors.warning} />
          <Text style={styles.warningText}>
            The test will automatically move forward when time runs out.
          </Text>
        </View>

        <Button
          title="Begin Test"
          onPress={handleBeginTest}
          loading={introInProgress}
          disabled={introInProgress}
          style={styles.primaryButton}
        />

        <Button
          title="Cancel"
          variant="ghost"
          onPress={onEnd}
          disabled={introInProgress}
          style={styles.ghostButton}
        />
      </View>
    </View>
  );

  // Render Part 2 preparation screen
  const renderPart2Prep = () => (
    <View style={styles.centerContainer}>
      <Text style={styles.partLabel}>Part 2: Preparation Time</Text>
      <Text style={styles.prepTimer}>{formatTime(prepTimer)}</Text>

      {part2Topic?.cueCard && (
        <View style={styles.cueCard}>
          <Text style={styles.cueCardTitle}>
            {part2Topic.cueCard.mainTopic}
          </Text>
          <Text style={styles.cueCardSubtitle}>Describe:</Text>
          {part2Topic.cueCard.bulletPoints.map((point, index) => (
            <Text key={index} style={styles.cueCardBullet}>
              • {point}
            </Text>
          ))}
          <Text style={styles.cueCardNote}>
            You have 1 minute to prepare. You can make notes.
          </Text>
          <Text style={styles.cueCardNote}>
            You will have 2 minutes to speak.
          </Text>
        </View>
      )}

      <Text style={styles.prepInstructions}>
        📝 Use this time to organize your thoughts. Speaking will begin
        automatically.
      </Text>
    </View>
  );

  // Render main conversation screen
  const renderConversation = () => {
    const partLabel =
      currentState === "part1"
        ? "Part 1: Introduction & Interview"
        : currentState === "part2-speak"
        ? "Part 2: Individual Long Turn"
        : "Part 3: Two-way Discussion";

    const timeLimit =
      currentState === "part1"
        ? PART1_DURATION
        : currentState === "part2-speak"
        ? PART2_SPEAK_DURATION
        : PART3_DURATION;

    const timeRemaining = timeLimit - partTimer;

    return (
      <Pressable
        style={styles.container}
        disabled={!isRecording || isProcessing}
        onPress={() => {
          if (isRecording && !isProcessing) {
            stopRecording();
          }
        }}
      >
        <View style={styles.header}>
          <Text style={styles.partLabel}>{partLabel}</Text>
          <View style={styles.timerContainer}>
            <Ionicons name="time-outline" size={16} color={colors.warning} />
            <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
          </View>
        </View>

        {currentQuestion && (
          <View style={styles.questionCard}>
            <Text style={styles.questionLabel}>Current Question:</Text>
            <Text style={styles.questionText}>{currentQuestion}</Text>
          </View>
        )}

        <View style={styles.orbContainer}>
          <VoiceOrb {...getOrbProps()} />
        </View>

        <View style={styles.promptContainer}>
          <Text style={styles.promptText}>{promptMessage}</Text>
          {isRecording && (
            <Text style={styles.promptSubText}>
              Tap anywhere when you finish speaking.
            </Text>
          )}
        </View>
      </Pressable>
    );
  };
  // Main render
  return (
    <View style={styles.backgroundContainer}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />
        {currentState === "intro" && renderIntro()}
        {currentState === "part2-prep" && renderPart2Prep()}
        {(currentState === "part1" ||
          currentState === "part2-speak" ||
          currentState === "part3") &&
          renderConversation()}
        {currentState === "complete" && (
          <View style={styles.centerContainer}>
            <View style={styles.introContent}>
              <Text style={styles.title}>Processing Results...</Text>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  backgroundContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  introContent: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },
  introHeader: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  partLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.primary,
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  timerText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.warning,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    textAlign: "center",
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
    gap: spacing.sm,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  infoItem: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  infoBullet: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
  },
  infoText: {
    flex: 1,
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xl,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: colors.warning,
  },
  primaryButton: {
    alignSelf: "stretch",
    marginTop: spacing.lg,
  },
  ghostButton: {
    alignSelf: "stretch",
  },
  prepTimer: {
    fontSize: 56,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: spacing.xl,
    textAlign: "center",
  },
  cueCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    maxWidth: 420,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cueCardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  cueCardSubtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  cueCardBullet: {
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    lineHeight: 22,
  },
  cueCardNote: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: "italic",
    marginTop: spacing.sm,
  },
  prepInstructions: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
  },
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    ...shadows.card,
  },
  questionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  questionText: {
    fontSize: 18,
    color: colors.textPrimary,
    lineHeight: 26,
  },
  orbContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: spacing.xl,
  },
  promptContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  promptText: {
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: "center",
    lineHeight: 22,
  },
  promptSubText: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
