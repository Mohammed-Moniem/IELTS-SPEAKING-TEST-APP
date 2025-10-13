import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { processConversationTurn } from "../api/speechApi";
import { VoiceOrb } from "./VoiceOrb";

type ConversationMode = "practice" | "simulation";
type ConversationState = "idle" | "recording" | "processing" | "ai-speaking";

interface VoiceConversationProps {
  mode: ConversationMode;
  onEnd: () => void;
}

export const VoiceConversation: React.FC<VoiceConversationProps> = ({
  mode,
  onEnd,
}) => {
  const [state, setState] = useState<ConversationState>("idle");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [timer, setTimer] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: "system" | "user" | "assistant"; content: string }>
  >([
    {
      role: "system",
      content:
        "You are an IELTS examiner conducting a speaking test. Be professional, encouraging, and ask clear questions.",
    },
  ]);

  useEffect(() => {
    // Request microphone permissions on mount
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Microphone Permission Required",
          "Please enable microphone access to use voice features."
        );
      }
    })();

    // Configure audio mode for recording
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });

    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state === "recording") {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [state]);

  const startRecording = async () => {
    try {
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
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
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        throw new Error("No audio URI received");
      }

      console.log("🎤 Recorded audio:", uri);

      // Process the conversation turn: transcribe → get AI response → play audio
      try {
        const result = await processConversationTurn(
          uri,
          conversationHistory,
          1, // Start with Part 1 (general questions)
          {
            topic: mode === "practice" ? "General Conversation" : "Full Test",
            userLevel: "intermediate",
          }
        );

        console.log("✅ Conversation turn complete!");
        console.log("📝 You said:", result.userTranscript);
        console.log("💬 AI says:", result.examinerResponse);

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
    } catch (error) {
      console.error("Failed to stop recording:", error);
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
          audioSound.unloadAsync();
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
        return "Processing...";
      case "ai-speaking":
        return "AI Examiner Speaking...";
      default:
        return "Tap to speak";
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onEnd} style={styles.iconButton}>
          <Ionicons name="close" size={24} color="#ffffff" />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>
            {mode === "simulation" ? "Full Test Simulation" : "Practice Mode"}
          </Text>
          {state === "recording" && (
            <Text style={styles.timer}>{formatTime(timer)}</Text>
          )}
        </View>

        <TouchableOpacity style={styles.iconButton}>
          <Ionicons
            name="information-circle-outline"
            size={24}
            color="#ffffff"
          />
        </TouchableOpacity>
      </View>

      {/* Center - Voice Orb */}
      <View style={styles.orbContainer}>
        <VoiceOrb
          isListening={state === "recording"}
          isSpeaking={state === "ai-speaking"}
        />

        <Text style={styles.stateText}>{getStateMessage()}</Text>

        {state === "ai-speaking" && (
          <View style={styles.transcriptBox}>
            <Text style={styles.transcriptText}>
              "Let's talk about your hometown. Where are you from?"
            </Text>
          </View>
        )}
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={toggleMute}
        >
          <Ionicons
            name={isMuted ? "mic-off" : "mic"}
            size={28}
            color="#ffffff"
          />
        </TouchableOpacity>

        {state === "idle" || state === "ai-speaking" ? (
          <TouchableOpacity
            style={styles.recordButton}
            onPress={startRecording}
            disabled={state === "ai-speaking"}
          >
            <Ionicons name="mic" size={32} color="#ffffff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.recordButton, styles.recordButtonActive]}
            onPress={stopRecording}
          >
            <Ionicons name="stop" size={32} color="#ffffff" />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.controlButton} onPress={onEnd}>
          <Ionicons name="close-circle" size={28} color="#ff4444" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 16,
  },
  topBarCenter: {
    flex: 1,
    alignItems: "center",
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  timer: {
    fontSize: 14,
    color: "#d4a745",
    marginTop: 4,
    fontWeight: "500",
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  orbContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  stateText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#ffffff",
    marginTop: 40,
    textAlign: "center",
  },
  transcriptBox: {
    marginTop: 30,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 16,
    maxWidth: "90%",
  },
  transcriptText: {
    fontSize: 16,
    color: "#ffffff",
    lineHeight: 24,
    textAlign: "center",
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 40,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    paddingTop: 24,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  controlButtonActive: {
    backgroundColor: "#d4a745",
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#d4a745",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#d4a745",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  recordButtonActive: {
    backgroundColor: "#ff4444",
  },
});
