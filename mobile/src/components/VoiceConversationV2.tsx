import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import React, { useEffect, useState } from "react";
import {
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { evaluateResponse, processConversationTurn } from "../api/speechApi";
import { ttsService } from "../services/textToSpeechService";
import { colors, radii, shadows, spacing } from "../theme/tokens";
import { VoiceOrb } from "./VoiceOrb";

type ConversationMode = "practice" | "simulation";
type ConversationState =
  | "idle"
  | "recording"
  | "processing"
  | "ai-speaking"
  | "complete";

interface VoiceConversationProps {
  mode: ConversationMode;
  topic?: string;
  question?: string;
  part?: 1 | 2 | 3;
  onEnd: () => void;
  onEvaluationComplete?: (data: {
    overallBand: number;
    criteria: any;
    corrections: any[];
    suggestions: any[];
    bandComparison?: any;
    transcript: string;
    audioUri: string;
    duration: number;
  }) => void;
}

export const VoiceConversation: React.FC<VoiceConversationProps> = ({
  mode,
  topic = "General Conversation",
  question = "Tell me about yourself.",
  part = 1,
  onEnd,
  onEvaluationComplete,
}) => {
  const [state, setState] = useState<ConversationState>("idle");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [timer, setTimer] = useState(0);
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [evaluationData, setEvaluationData] = useState<any>(null);
  const [recordedAudioUri, setRecordedAudioUri] = useState<string | null>(null);
  const [userTranscript, setUserTranscript] = useState<string>("");

  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: "system" | "user" | "assistant"; content: string }>
  >([
    {
      role: "system",
      content:
        "You are an IELTS examiner conducting a speaking test. Be professional, encouraging, and ask clear questions.",
    },
  ]);

  const sanitizeSpeechText = (input?: string, fallback?: string) => {
    const trimmedInput = input?.trim() ?? "";
    const fallbackTrimmed = fallback?.trim() ?? "";
    const cleaned = trimmedInput
      .replace(/^(undefined|null)\s*[.,;:!?-]*/i, "")
      .trim();

    if (cleaned.length > 0) {
      return cleaned;
    }

    if (fallbackTrimmed.length > 0) {
      return fallbackTrimmed;
    }

    return "";
  };

  const normalizedQuestion = sanitizeSpeechText(
    question,
    "Tell me about yourself."
  );

  useEffect(() => {
    // Request microphone permissions on mount
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Microphone Permission Required",
          "Please enable microphone access to use voice features."
        );
        return;
      }

      // Don't configure audio mode before TTS - let expo-speech handle it
      // We'll configure for recording after TTS completes

      // Speak examiner introduction and question
      try {
        console.log(`🎙️ Speaking Part ${part} introduction and question...`);
        setState("ai-speaking");

        await ttsService.speakIntroductionAndQuestion(
          part,
          normalizedQuestion,
          async () => {
            console.log("✅ Examiner finished speaking, ready to record");

            // NOW configure audio mode for recording
            await Audio.setAudioModeAsync({
              allowsRecordingIOS: true,
              playsInSilentModeIOS: true,
              staysActiveInBackground: false,
              shouldDuckAndroid: false,
              playThroughEarpieceAndroid: false,
            });

            setState("idle");
          }
        );
      } catch (error) {
        console.error("Failed to speak introduction:", error);
        setState("idle");
      }
    })();

    return () => {
      // Cleanup function - stop everything when component unmounts
      console.log("🧹 Cleaning up VoiceConversation component...");

      // Stop TTS immediately when user goes back
      ttsService.stop();

      if (recording) {
        recording.stopAndUnloadAsync().catch((err) => {
          console.log(
            "Recording cleanup error (expected if already unloaded):",
            err
          );
        });
      }
      if (sound) {
        sound.unloadAsync().catch((err) => {
          console.log(
            "Sound cleanup error (expected if already unloaded):",
            err
          );
        });
      }
    };
  }, []); // Run only on mount

  // Timer effect with time limits
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state === "recording") {
      interval = setInterval(() => {
        setTimer((prev) => {
          const newTime = prev + 1;

          // Get time limit based on part
          const timeLimit = getTimeLimit(part);

          // Auto-stop when time limit reached
          if (newTime >= timeLimit) {
            console.log(
              `⏱️ Time limit (${timeLimit}s) reached, stopping recording...`
            );
            stopRecording();
            Alert.alert(
              "Time's Up!",
              `You've reached the ${formatTime(
                timeLimit
              )} time limit for Part ${part}.`,
              [{ text: "OK" }]
            );
          }

          return newTime;
        });
      }, 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [state, part]);

  const getTimeLimit = (part: 1 | 2 | 3): number => {
    // Time limits in seconds
    switch (part) {
      case 1:
        return 5 * 60; // 5 minutes
      case 2:
        return 2 * 60; // 2 minutes speaking (after 1 min prep)
      case 3:
        return 5 * 60; // 5 minutes
      default:
        return 5 * 60;
    }
  };

  const startRecording = async () => {
    try {
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setRecordingStartTime(Date.now());
      setState("recording");
    } catch (error) {
      console.error("Failed to start recording:", error);
      Alert.alert(
        "Recording Error",
        "Failed to start recording. Please try again."
      );
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setState("processing");

      // Stop and unload recording
      await recording.stopAndUnloadAsync().catch((err) => {
        console.log("Stop recording error:", err);
        // If already unloaded, just continue
      });

      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        throw new Error("No audio URI received");
      }

      console.log("🎤 Recorded audio:", uri);
      setRecordedAudioUri(uri);

      if (mode === "practice") {
        // Practice Mode: Evaluate immediately after recording
        await handlePracticeEvaluation(uri);
      } else {
        // Simulation Mode: Continue conversation
        await handleSimulationTurn(uri);
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
      setState("idle");
    }
  };

  const handlePracticeEvaluation = async (audioUri: string) => {
    try {
      console.log("📊 Evaluating practice response...");

      // Speak transition message before evaluation
      setState("ai-speaking");
      try {
        await ttsService.speakEvaluationTransition();
      } catch (ttsError) {
        console.error("TTS transition error (continuing):", ttsError);
      }
      setState("processing");

      // First, transcribe the audio
      const { transcribeAudio } = await import("../api/speechApi");
      const transcription = await transcribeAudio(audioUri);

      console.log("📝 Transcription:", transcription.text);
      setUserTranscript(transcription.text);

      // Then evaluate the response
      const evaluation = await evaluateResponse(
        transcription.text,
        normalizedQuestion,
        part // Use the selected part
      );

      console.log("✅ Evaluation complete:", evaluation);
      setEvaluationData(evaluation);

      // Speak the summary before showing results
      try {
        setState("ai-speaking");
        const summaryCore = sanitizeSpeechText(
          evaluation.spokenSummary,
          `Your overall band score is ${evaluation.overallBand}.`
        );
        const summaryWithPunctuation = summaryCore
          ? /[.!?]$/u.test(summaryCore)
            ? summaryCore
            : `${summaryCore}.`
          : "";
        const summaryText = summaryWithPunctuation
          ? `${summaryWithPunctuation} Please check the detailed evaluation screen for specific examples, vocabulary alternatives, and band-level comparisons to help you improve.`
          : "";

        if (summaryText.length > 0) {
          await ttsService.speak(summaryText);
        }
      } catch (ttsError) {
        console.error("TTS summary error (continuing):", ttsError);
      }

      setState("complete");

      // Calculate recording duration
      const duration =
        recordingStartTime > 0
          ? Math.floor((Date.now() - recordingStartTime) / 1000)
          : 0;

      // Pass evaluation data to parent instead of showing nested modal
      if (onEvaluationComplete && audioUri) {
        onEvaluationComplete({
          overallBand: evaluation.overallBand,
          criteria: evaluation.criteria,
          corrections: evaluation.corrections || [],
          suggestions: evaluation.suggestions || [],
          bandComparison: evaluation.bandComparison,
          transcript: transcription.text,
          audioUri: audioUri,
          duration,
        });
      }
    } catch (error: any) {
      console.error("❌ Evaluation error:", error);
      const errorMessage =
        typeof error?.message === "string" &&
        error.message.toLowerCase().includes("timeout")
          ? "The evaluation is taking longer than expected, but the server is still working on it. Please give it another moment and check the Results tab if it doesn't appear automatically."
          : error.message || "Failed to evaluate your response. Please try again.";
      Alert.alert(
        "Evaluation Error",
        errorMessage
      );
      setState("idle");
    }
  };

  const handleSimulationTurn = async (audioUri: string) => {
    try {
      console.log("🔄 Processing conversation turn...");

      const result = await processConversationTurn(
        audioUri,
        conversationHistory,
        1, // Part 1 for now
        {
          topic,
          userLevel: "intermediate",
        }
      );

      console.log("✅ Conversation turn complete!");
      console.log("📝 You said:", result.userTranscript);
      console.log("💬 AI says:", result.examinerResponse);

      setUserTranscript(result.userTranscript);

      // Update conversation history
      setConversationHistory((prev) => [
        ...prev,
        { role: "user", content: result.userTranscript },
        { role: "assistant", content: result.examinerResponse },
      ]);

      // Play AI response audio
      setState("ai-speaking");
      await playAudioResponse(result.audioUrl);

      // Return to idle state after audio finishes
      setState("idle");
    } catch (error: any) {
      console.error("❌ Conversation error:", error);
      Alert.alert(
        "Connection Error",
        error.message ||
          "Failed to process your response. Please check your connection and try again."
      );
      setState("idle");
    }
  };

  const playAudioResponse = async (audioData: string) => {
    try {
      console.log("🔊 Playing AI response...");

      // audioData is base64 data URL (data:audio/mpeg;base64,...)
      const { sound: audioSound } = await Audio.Sound.createAsync(
        { uri: audioData },
        { shouldPlay: true }
      );

      setSound(audioSound);

      // Wait for playback to finish
      audioSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          console.log("✅ Audio playback complete");
          audioSound.unloadAsync().catch((err) => {
            console.log(
              "Audio unload error (expected if already unloaded):",
              err
            );
          });
          setSound(null);
        }
      });
    } catch (error) {
      console.error("❌ Audio playback error:", error);
      throw error;
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStateMessage = () => {
    switch (state) {
      case "recording":
        return "Listening...";
      case "processing":
        return mode === "practice" ? "Evaluating..." : "Processing...";
      case "ai-speaking":
        return "Examiner Speaking...";
      case "complete":
        return "Complete!";
      default:
        return mode === "practice"
          ? "Tap mic to record your answer"
          : "Tap mic to speak";
    }
  };

  const getOrbProps = (): { isListening: boolean; isSpeaking: boolean } => {
    return {
      isListening: state === "recording",
      isSpeaking: state === "ai-speaking",
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={onEnd}
          style={styles.iconButton}
          disabled={state === "ai-speaking"}
        >
          <Ionicons
            name="close"
            size={24}
            color={
              state === "ai-speaking" ? colors.textMuted : colors.textPrimary
            }
          />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={styles.modeText}>
            {mode === "practice"
              ? `Practice Mode - Part ${part}`
              : "Simulation Mode"}
          </Text>
          {state === "recording" && (
            <Text style={styles.timerText}>
              {formatTime(timer)} / {formatTime(getTimeLimit(part))}
            </Text>
          )}
        </View>

        <TouchableOpacity onPress={() => {}} style={styles.iconButton}>
          <Ionicons
            name="information-circle-outline"
            size={24}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* Question Display for Practice Mode */}
      {mode === "practice" && (
        <View style={styles.questionContainer}>
          <Text style={styles.questionLabel}>Question:</Text>
          <Text style={styles.questionText}>{normalizedQuestion}</Text>

          {/* Show listening indicator when examiner is speaking */}
          {state === "ai-speaking" && (
            <View style={styles.examinerSpeakingIndicator}>
              <Ionicons name="volume-high" size={20} color={colors.info} />
              <Text style={styles.examinerSpeakingText}>
                Please listen to the examiner...
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Center content */}
      <View style={styles.centerContent}>
        <VoiceOrb {...getOrbProps()} />
        <Text style={styles.stateText}>{getStateMessage()}</Text>
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomControls}>
        <TouchableOpacity
          onPress={toggleMute}
          style={[
            styles.controlButton,
            isMuted && styles.mutedButton,
            (state === "processing" || state === "complete") &&
              styles.controlButtonDisabled,
          ]}
          disabled={state === "processing" || state === "complete"}
        >
          <Ionicons
            name={isMuted ? "volume-mute" : "volume-high"}
            size={24}
            color={
              state === "processing" || state === "complete"
                ? colors.textSecondary
                : colors.textPrimary
            }
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={state === "recording" ? stopRecording : startRecording}
          style={[
            styles.micButton,
            state === "recording" && styles.micButtonActive,
            (state === "processing" ||
              state === "ai-speaking" ||
              state === "complete") &&
              styles.micButtonDisabled,
          ]}
          disabled={
            state === "processing" ||
            state === "ai-speaking" ||
            state === "complete"
          }
        >
          <Ionicons
            name={state === "recording" ? "stop" : "mic"}
            size={32}
            color={
              state === "processing" ||
              state === "ai-speaking" ||
              state === "complete"
                ? colors.textSecondary
                : colors.textPrimary
            }
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onEnd}
          style={[
            styles.controlButton,
            (state === "processing" || state === "complete") &&
              styles.controlButtonDisabled,
          ]}
          disabled={state === "processing" || state === "complete"}
        >
          <Ionicons
            name="exit-outline"
            size={24}
            color={
              state === "processing" || state === "complete"
                ? colors.textSecondary
                : colors.textPrimary
            }
          />
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarCenter: {
    alignItems: "center",
  },
  modeText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
  },
  timerText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  questionContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  questionLabel: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  questionText: {
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 24,
  },
  examinerSpeakingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  examinerSpeakingText: {
    fontSize: 14,
    color: colors.info,
    marginLeft: spacing.xs,
    fontStyle: "italic",
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  stateText: {
    fontSize: 18,
    color: colors.textSecondary,
    marginTop: spacing.xl,
    textAlign: "center",
  },
  bottomControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  controlButtonDisabled: {
    backgroundColor: colors.backgroundMuted,
    opacity: 0.5,
  },
  mutedButton: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  micButtonActive: {
    backgroundColor: colors.danger,
    shadowColor: colors.danger,
  },
  micButtonDisabled: {
    backgroundColor: colors.surfaceSubtle,
    shadowColor: shadows.card.shadowColor,
  },
});
