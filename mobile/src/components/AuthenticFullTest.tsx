import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { GeneratedTopic, getCachedRandomTopic } from "../api/topicApi";
import { useTheme } from "../context";
import { useThemedStyles } from "../hooks";
import { resultsStorage } from "../services/resultsStorage";
import { ttsService } from "../services/textToSpeechService";
import type { ColorTokens } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { logger } from "../utils/logger";
import { VoiceOrb } from "./VoiceOrb";

/**
 * Authentic IELTS Full Test Component
 * - NO manual buttons during test
 * - Automatic recording after examiner speaks
 * - Follows exact IELTS test format (Part 1, 2, 3)
 * - Natural conversation flow
 */

type TestState =
  | "loading" // Loading questions
  | "intro" // Initial welcome
  | "part1-question" // Examiner asking Part 1 question
  | "part1-answering" // User answering Part 1
  | "part1-complete" // Part 1 finished
  | "part2-intro" // Part 2 introduction
  | "part2-cuecard" // Reading cue card
  | "part2-prep" // 1 minute preparation
  | "part2-prompt" // Prompting to speak
  | "part2-speaking" // User speaking 1-2 minutes
  | "part2-complete" // Part 2 finished
  | "part3-intro" // Part 3 introduction
  | "part3-question" // Examiner asking Part 3 question
  | "part3-answering" // User answering Part 3
  | "part3-complete" // Part 3 finished
  | "test-complete"; // Entire test complete

interface AuthenticTestProps {
  onComplete: (results: any) => void;
  onExit: () => void;
}

export const AuthenticFullTest: React.FC<AuthenticTestProps> = ({
  onComplete,
  onExit,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [state, setState] = useState<TestState>("loading");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [timer, setTimer] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState(
    "Loading test questions..."
  );

  // Questions for all parts
  const [part1Questions, setPart1Questions] = useState<GeneratedTopic[]>([]);
  const [part2Topic, setPart2Topic] = useState<GeneratedTopic | null>(null);
  const [part3Questions, setPart3Questions] = useState<GeneratedTopic[]>([]);

  // Current question tracking
  const [currentPart, setCurrentPart] = useState<1 | 2 | 3>(1);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Recordings storage
  const part1Recordings = useRef<string[]>([]);
  const part2Recording = useRef<string | null>(null);
  const part3Recordings = useRef<string[]>([]);

  // Timing
  const testStartTime = useRef<number>(Date.now());
  const recordingStartTime = useRef<number>(0);

  // Silence detection for natural flow
  const [isSpeaking, setIsSpeaking] = useState(false);
  const lastSpeechTime = useRef<number>(Date.now());
  const silenceCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Prompt animation
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptMessage, setPromptMessage] = useState("");
  const promptOpacity = useRef(new Animated.Value(0)).current;

  // Initialize test
  useEffect(() => {
    initializeTest();
    const backHandlerCleanup = setupBackHandler();

    return () => {
      cleanup();
      backHandlerCleanup();
    };
  }, []);

  const setupBackHandler = () => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handleExitAttempt();
        return true;
      }
    );
    return () => backHandler.remove();
  };

  const handleExitAttempt = () => {
    Alert.alert(
      "Exit Full Test?",
      "⚠️ If you leave now, this test will NOT be evaluated and your progress will be lost.\n\nAre you sure you want to exit?",
      [
        { text: "Stay in Test", style: "cancel" },
        {
          text: "Exit Test",
          style: "destructive",
          onPress: async () => {
            await cleanup();
            onExit();
          },
        },
      ]
    );
  };

  const cleanup = async () => {
    console.log("🧹 Cleaning up test...");

    // Stop TTS
    await ttsService.stop();

    // Clear all intervals and timeouts
    if (silenceCheckInterval.current) {
      clearInterval(silenceCheckInterval.current);
    }
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }

    // Stop any recording
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
      } catch (err) {
        console.log("Recording cleanup:", err);
      }
    }

    // Reset audio mode
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
      });
    } catch (err) {
      console.log("Audio mode reset:", err);
    }
  };

  const initializeTest = async () => {
    try {
      console.log("🎯 Initializing full IELTS test...");
      setLoadingMessage("Requesting microphone permission...");

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

      setLoadingMessage("Loading test questions...");

      // Load all questions
      const usedQuestions = await resultsStorage.getUsedQuestions();

      // Part 1: 4-5 questions about familiar topics
      const p1Questions = await Promise.all([
        getCachedRandomTopic("part1", "medium", usedQuestions),
        getCachedRandomTopic("part1", "medium", usedQuestions),
        getCachedRandomTopic("part1", "medium", usedQuestions),
        getCachedRandomTopic("part1", "medium", usedQuestions),
      ]);
      setPart1Questions(p1Questions);

      setLoadingMessage("Loading Part 2 cue card...");

      // Part 2: 1 cue card topic
      const p2Topic = await getCachedRandomTopic(
        "part2",
        "medium",
        usedQuestions
      );
      setPart2Topic(p2Topic);

      setLoadingMessage("Loading Part 3 discussion questions...");

      // Part 3: 3-4 discussion questions
      const p3Questions = await Promise.all([
        getCachedRandomTopic("part3", "medium", usedQuestions),
        getCachedRandomTopic("part3", "medium", usedQuestions),
        getCachedRandomTopic("part3", "medium", usedQuestions),
      ]);
      setPart3Questions(p3Questions);

      // Mark all as used
      for (const q of p1Questions) {
        await resultsStorage.markQuestionAsUsed(q.question, 1);
      }
      await resultsStorage.markQuestionAsUsed(p2Topic.question, 2);
      for (const q of p3Questions) {
        await resultsStorage.markQuestionAsUsed(q.question, 3);
      }

      console.log("✅ Questions loaded successfully");
      setLoadingMessage("Starting test...");

      // Start the test
      startIntroduction();
    } catch (error) {
      logger.warn("Failed to initialize test:", error);
      Alert.alert(
        "Error",
        "Failed to load test questions. Please check your connection and try again.",
        [{ text: "OK", onPress: onExit }]
      );
    }
  };

  const startIntroduction = async () => {
    try {
      console.log("🎬 Starting introduction...");
      setState("intro");
      setCurrentPart(1);

      // Configure audio for loudspeaker
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
      });

      console.log("✅ Audio mode configured");

      // Speak welcome - SHORT and CLEAR
      const welcome =
        "Good morning. I'm your examiner for today's IELTS Speaking test. Let's begin with Part 1.";

      console.log("🗣️ Speaking welcome message...");
      console.log(`📢 Message: "${welcome}"`);

      await ttsService.speak(welcome, {
        onDone: () => {
          console.log(
            "✅ Welcome message completed - waiting 2 seconds before first question"
          );
          // Wait 2 seconds after welcome, then start Part 1 questions
          console.log("⏳ Waiting 2 seconds before first question...");
          setTimeout(() => {
            console.log("🎯 Now asking first Part 1 question");
            askNextPart1Question();
          }, 2000);
        },
        onError: (error) => {
          logger.warn("❌ TTS Error:", error);
          Alert.alert(
            "Audio Error",
            "Failed to play examiner voice. Please check your device volume and try again.",
            [
              { text: "Try Again", onPress: () => startIntroduction() },
              { text: "Exit", onPress: onExit },
            ]
          );
        },
      });
    } catch (error) {
      logger.warn("❌ Failed to start introduction:", error);
      Alert.alert("Error", "Failed to start test. Please try again.", [
        { text: "OK", onPress: onExit },
      ]);
    }
  };

  const askNextPart1Question = async () => {
    try {
      const questionIndex = currentQuestionIndex;

      console.log(`\n========================================`);
      console.log(
        `📝 Part 1 Question ${questionIndex + 1}/${part1Questions.length}`
      );
      console.log(`========================================`);

      if (questionIndex >= part1Questions.length) {
        // Part 1 complete
        console.log("✅ Part 1 complete - moving to Part 2");
        finishPart1();
        return;
      }

      const question = part1Questions[questionIndex];
      console.log(`🗣️ Examiner asking: "${question.question}"`);

      setState("part1-question");

      await ttsService.speak(question.question, {
        onDone: async () => {
          console.log("✅ Question spoken");
          console.log("⏳ Pausing 2 seconds for thinking time...");

          // Show thinking prompt
          showTimedPrompt("Take a moment to think...", 2000);

          // Wait 2 seconds
          await new Promise((resolve) => setTimeout(resolve, 2000));

          console.log("🎤 Now it's your turn to speak!");
          showTimedPrompt("Please speak your answer", 2000);
          setState("part1-answering");

          // Configure for recording
          console.log("🔧 Configuring audio for recording...");
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            playThroughEarpieceAndroid: false,
          });
          console.log("✅ Audio configured for recording");

          // Wait 1.5 seconds before starting recording
          await new Promise((resolve) => setTimeout(resolve, 1500));

          console.log("🔴 STARTING RECORDING NOW");
          await startRecording(60, 1); // 60 seconds max for Part 1
        },
        onError: (error) => {
          logger.warn("❌ TTS Error in Part 1:", error);
          Alert.alert(
            "Audio Error",
            "Failed to play question. Please check your connection.",
            [
              {
                text: "Skip Question",
                onPress: () => {
                  setCurrentQuestionIndex((prev) => prev + 1);
                  setTimeout(() => askNextPart1Question(), 1000);
                },
              },
              { text: "Exit Test", onPress: onExit },
            ]
          );
        },
      });
    } catch (error) {
      logger.warn("❌ Error in askNextPart1Question:", error);
      Alert.alert("Error", "An error occurred. Would you like to continue?", [
        { text: "Try Again", onPress: () => askNextPart1Question() },
        { text: "Exit", onPress: onExit },
      ]);
    }
  };

  const startRecording = async (maxDuration: number, partType: 1 | 2 | 3) => {
    try {
      console.log(`\n🎤 ============================================`);
      console.log(`🎤 STARTING RECORDING for Part ${partType}`);
      console.log(`🎤 Max duration: ${maxDuration} seconds`);
      console.log(`🎤 ============================================\n`);

      // Check if already recording
      if (recording) {
        console.warn(
          "⚠️ Already recording! Stopping previous recording first..."
        );
        await recording.stopAndUnloadAsync();
        setRecording(null);
      }

      // Request permissions first
      console.log("🔐 Requesting microphone permissions...");
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        logger.warn("❌ Microphone permission denied!");
        Alert.alert(
          "Permission Required",
          "Microphone access is required to record your answers. Please grant permission in settings.",
          [{ text: "OK" }]
        );
        return;
      }
      console.log("✅ Microphone permission granted");

      // Configure audio mode for recording
      console.log("🔧 Setting audio mode for recording...");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
      console.log("✅ Audio mode set");

      // Create recording
      console.log("📱 Creating audio recording...");
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          // Status updates - metering for silence detection
          if (status.isRecording && status.metering !== undefined) {
            if (status.metering > -50) {
              // Voice detected
              updateSpeechActivity();
            }
          }
        },
        100 // Update interval for metering (100ms)
      );

      console.log("✅ Recording created successfully!");
      console.log(`🔴 RECORDING IS NOW ACTIVE - Speak your answer!`);

      setRecording(newRecording);
      recordingStartTime.current = Date.now();
      setIsSpeaking(true);
      lastSpeechTime.current = Date.now();

      // Start monitoring for silence (natural end of answer)
      console.log("👂 Starting silence detection...");
      startSilenceDetection(partType);

      // Safety timeout - stop after max duration
      console.log(`⏰ Setting safety timeout for ${maxDuration} seconds`);
      recordingTimeoutRef.current = setTimeout(() => {
        console.log(
          `⏰ Max recording time (${maxDuration}s) reached - stopping`
        );
        if (recording) {
          stopRecordingAndProceed(partType);
        }
      }, maxDuration * 1000);

      console.log("🎤 Recording setup complete. Waiting for your answer...\n");
    } catch (error) {
      logger.warn("❌ ============================================");
      logger.warn("❌ FAILED TO START RECORDING!");
      logger.warn("❌ Error:", error);
      logger.warn("❌ ============================================");
      Alert.alert(
        "Recording Error",
        "Failed to start recording. Please check your microphone permissions and try again.",
        [
          {
            text: "Try Again",
            onPress: () => startRecording(maxDuration, partType),
          },
          { text: "Exit", onPress: onExit },
        ]
      );
    }
  };

  const startSilenceDetection = (partType: 1 | 2 | 3) => {
    // Clear any existing interval
    if (silenceCheckInterval.current) {
      clearInterval(silenceCheckInterval.current);
    }

    // SIMPLIFIED: Just check recording duration periodically
    // User will tap to finish when done
    console.log("👂 Monitoring recording (tap orb to finish)...");

    silenceCheckInterval.current = setInterval(() => {
      const recordingDuration =
        (Date.now() - recordingStartTime.current) / 1000;

      // Log every 5 seconds
      if (Math.floor(recordingDuration) % 5 === 0) {
        console.log(`⏱️  Recording time: ${Math.floor(recordingDuration)}s`);
      }

      // For Part 2, warn at 90 seconds (should speak for 1-2 minutes)
      if (partType === 2 && recordingDuration >= 90 && recordingDuration < 91) {
        console.log("⚠️ 90 seconds reached - you should finish soon");
        showTimedPrompt("Please finish your answer soon", 2000);
      }

      // No auto-stop based on silence for now - just manual tap
    }, 1000); // Check every second
  };

  // Simulate speech activity (in real app, use audio level monitoring)
  const updateSpeechActivity = () => {
    lastSpeechTime.current = Date.now();
    setIsSpeaking(true);
  };

  const stopRecordingAndProceed = async (partType: 1 | 2 | 3) => {
    console.log(`\n⏹️  ============================================`);
    console.log(`⏹️  STOPPING RECORDING for Part ${partType}`);
    console.log(`⏹️  ============================================`);

    // Clear timeouts/intervals
    if (silenceCheckInterval.current) {
      clearInterval(silenceCheckInterval.current);
      silenceCheckInterval.current = null;
      console.log("✅ Silence detection cleared");
    }
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
      console.log("✅ Safety timeout cleared");
    }

    if (!recording) {
      console.warn("⚠️ No recording to stop!");
      return;
    }

    try {
      console.log("🛑 Stopping recording...");

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setIsSpeaking(false);

      if (!uri) {
        throw new Error("No audio URI received from recording!");
      }

      const duration = Math.round(
        (Date.now() - recordingStartTime.current) / 1000
      );
      console.log(`✅ Recording stopped successfully!`);
      console.log(`📁 File saved: ${uri}`);
      console.log(`⏱️  Duration: ${duration} seconds`);
      console.log(`\n`);

      // Save based on current part
      if (partType === 1) {
        part1Recordings.current.push(uri);
        console.log(
          `💾 Saved Part 1 answer #${part1Recordings.current.length}`
        );

        // Move to next Part 1 question after brief pause
        setCurrentQuestionIndex((prev) => prev + 1);
        showTimedPrompt("Thank you", 1000);

        console.log("⏳ Waiting 2 seconds before next question...\n");
        setTimeout(() => {
          askNextPart1Question();
        }, 2000);
      } else if (partType === 2) {
        part2Recording.current = uri;
        console.log(`💾 Saved Part 2 long turn recording`);
        finishPart2();
      } else if (partType === 3) {
        part3Recordings.current.push(uri);
        console.log(
          `💾 Saved Part 3 answer #${part3Recordings.current.length}`
        );

        // Move to next Part 3 question after brief pause
        setCurrentQuestionIndex((prev) => prev + 1);
        showTimedPrompt("Thank you", 1000);

        console.log("⏳ Waiting 2 seconds before next question...\n");
        setTimeout(() => {
          askNextPart3Question();
        }, 2000);
      }
    } catch (error) {
      logger.warn("❌ Failed to stop recording:", error);
      Alert.alert("Error", "Failed to save your recording. Please try again.", [
        {
          text: "Continue",
          onPress: () => {
            // Try to continue despite error
            if (partType === 1) {
              setCurrentQuestionIndex((prev) => prev + 1);
              setTimeout(() => askNextPart1Question(), 1000);
            } else if (partType === 2) {
              finishPart2();
            } else {
              setCurrentQuestionIndex((prev) => prev + 1);
              setTimeout(() => askNextPart3Question(), 1000);
            }
          },
        },
        { text: "Exit", onPress: onExit },
      ]);
    }
  };

  // Manual finish button handler (tap orb when done speaking)
  const handleFinishAnswer = () => {
    console.log("\n👆 ============================================");
    console.log("👆 USER TAPPED ORB TO FINISH ANSWER");
    console.log("👆 ============================================\n");

    if (recording && currentPart) {
      const duration = Math.round(
        (Date.now() - recordingStartTime.current) / 1000
      );
      console.log(`⏱️  Recording duration: ${duration} seconds`);
      console.log(`📍 Current part: ${currentPart}`);
      stopRecordingAndProceed(currentPart);
    } else {
      console.warn("⚠️ No active recording to stop");
      if (!recording) {
        console.warn("  - recording is null");
      }
      if (!currentPart) {
        console.warn("  - currentPart is null");
      }
    }
  };

  const finishPart1 = async () => {
    try {
      console.log("🎬 Finishing Part 1...");
      setState("part1-complete");

      const closing = "Thank you. That's the end of Part 1.";
      await ttsService.speak(closing, {
        onDone: () => {
          console.log("✅ Part 1 closing complete");
          setTimeout(() => {
            startPart2();
          }, 2000);
        },
        onError: (error) => {
          logger.warn("❌ TTS Error in Part 1 closing:", error);
          // Still proceed to Part 2
          setTimeout(() => {
            startPart2();
          }, 2000);
        },
      });
    } catch (error) {
      logger.warn("❌ Error finishing Part 1:", error);
      // Still proceed to Part 2
      setTimeout(() => {
        startPart2();
      }, 2000);
    }
  };

  const startPart2 = async () => {
    setState("part2-intro");
    setCurrentPart(2);
    setCurrentQuestionIndex(0);

    const intro =
      "Now, I'm going to give you a topic and I'd like you to talk about it for one to two minutes. Before you talk, you'll have one minute to think about what you're going to say. You can make some notes if you wish. Here is your topic.";

    await ttsService.speak(intro, {
      onDone: async () => {
        if (part2Topic) {
          setState("part2-cuecard");
          await ttsService.speak(part2Topic.question, {
            onDone: () => {
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
      setTimer(60 - prepTime); // Countdown

      if (prepTime >= 60) {
        clearInterval(prepInterval);
        setTimer(0);
        promptToSpeakPart2();
      }
    }, 1000);
  };

  const promptToSpeakPart2 = async () => {
    setState("part2-prompt");

    const prompt =
      "Alright, remember you have one to two minutes for this. Please begin speaking now.";
    await ttsService.speak(prompt, {
      onDone: async () => {
        showTimedPrompt("Speak for 1-2 minutes", 2000);
        setState("part2-speaking");

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          playThroughEarpieceAndroid: false,
        });

        setTimeout(() => {
          startRecording(120, 2); // 2 minutes max for Part 2
        }, 2000);
      },
    });
  };

  const finishPart2 = async () => {
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
    setCurrentPart(3);
    setCurrentQuestionIndex(0);

    const intro =
      "We've been talking about your topic, and I'd like to discuss some more general questions related to this. Let's consider some broader issues.";

    await ttsService.speak(intro, {
      onDone: () => {
        askNextPart3Question();
      },
    });
  };

  const askNextPart3Question = async () => {
    const questionIndex = currentQuestionIndex;

    if (questionIndex >= part3Questions.length) {
      finishTest();
      return;
    }

    const question = part3Questions[questionIndex];
    setState("part3-question");

    await ttsService.speak(question.question, {
      onDone: async () => {
        showTimedPrompt("Take a moment to think...", 2000);

        // Give 2 seconds to think before recording Part 3 answers
        setTimeout(() => {
          showTimedPrompt("You may begin speaking", 1500);
          setState("part3-answering");

          Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            playThroughEarpieceAndroid: false,
          }).then(() => {
            setTimeout(() => {
              startRecording(90, 3); // 90 seconds max for Part 3
            }, 1500);
          });
        }, 2000);
      },
    });
  };

  const finishTest = async () => {
    setState("test-complete");

    const closing = "Thank you. That's the end of the speaking test.";
    await ttsService.speak(closing, {
      onDone: () => {
        processResults();
      },
    });
  };

  const processResults = () => {
    const totalDuration = Math.round(
      (Date.now() - testStartTime.current) / 1000
    );

    const results = {
      part1: {
        recordings: part1Recordings.current,
        questions: part1Questions,
      },
      part2: {
        recording: part2Recording.current,
        topic: part2Topic,
      },
      part3: {
        recordings: part3Recordings.current,
        questions: part3Questions,
      },
      totalDuration,
      completedAt: new Date().toISOString(),
    };

    console.log("✅ Test complete! Results:", results);
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

  // Timer effect for recording
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recording && !state.includes("prep")) {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else if (!state.includes("prep")) {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [recording, state]);

  const getHeaderText = (): string => {
    if (state === "loading") return "Loading Test...";
    if (state === "intro") return "Welcome";
    if (state.startsWith("part1")) return "Part 1: Introduction & Interview";
    if (state.startsWith("part2")) return "Part 2: Individual Long Turn";
    if (state.startsWith("part3")) return "Part 3: Two-way Discussion";
    if (state === "test-complete") return "Test Complete";
    return "IELTS Speaking Test";
  };

  const getSubtext = (): string => {
    if (state.includes("question")) return "Examiner speaking...";
    if (state.includes("answering") || state.includes("speaking"))
      return "You are speaking...";
    if (state === "part2-prep") return `Preparation time: ${timer}s remaining`;
    if (state.includes("intro") || state.includes("complete"))
      return "Please wait...";
    return "";
  };

  const getCurrentQuestion = (): string => {
    if (currentPart === 1 && part1Questions[currentQuestionIndex]) {
      return part1Questions[currentQuestionIndex].question;
    }
    if (currentPart === 2 && part2Topic && state.includes("part2")) {
      return part2Topic.question;
    }
    if (currentPart === 3 && part3Questions[currentQuestionIndex]) {
      return part3Questions[currentQuestionIndex].question;
    }
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
          <Ionicons name="close" size={24} color={colors.primaryOn} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{getHeaderText()}</Text>
          <Text style={styles.headerSubtitle}>{getSubtext()}</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {state === "loading" ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>{loadingMessage}</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              activeOpacity={recording ? 0.7 : 1}
              onPress={recording ? handleFinishAnswer : undefined}
              disabled={!recording}
            >
              <VoiceOrb
                isListening={recording !== null}
                isSpeaking={
                  state.includes("question") ||
                  state.includes("intro") ||
                  state.includes("prompt")
                }
              />
            </TouchableOpacity>

            {/* Tap hint when recording - PROMINENT */}
            {recording && (
              <View style={styles.tapHintContainer}>
                <Text style={styles.tapHint}>
                  👆 TAP THE ORB WHEN YOU FINISH
                </Text>
                <Text style={styles.tapHintSub}>
                  Tap the circle above to submit your answer
                </Text>
              </View>
            )}

            {/* Recording Timer */}
            {recording && !state.includes("prep") && (
              <View style={styles.timerContainer}>
                <View style={styles.timerDot} />
                <Text style={styles.timerText}>{formatTime(timer)}</Text>
              </View>
            )}

            {/* Question Display */}
            {getCurrentQuestion() && (
              <View style={styles.questionCard}>
                {currentPart === 2 && state.includes("part2") && (
                  <Text style={styles.partLabel}>Part 2 Cue Card</Text>
                )}
                <Text style={styles.questionText}>{getCurrentQuestion()}</Text>
                {state === "part2-prep" && (
                  <Text style={styles.prepText}>
                    Preparation time remaining: {timer} seconds
                  </Text>
                )}
              </View>
            )}
          </>
        )}
      </View>

      {/* Prompt Overlay */}
      {showPrompt && (
        <Animated.View
          style={[styles.promptOverlay, { opacity: promptOpacity }]}
        >
          <View style={styles.promptBadge}>
            <Ionicons name="mic" size={16} color={colors.primaryOn} />
            <Text style={styles.promptText}>{promptMessage}</Text>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
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
      color: colors.primaryOn,
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.primaryOn,
      opacity: 0.9,
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
    tapHintContainer: {
      marginTop: spacing.lg,
      alignItems: "center",
    },
    tapHint: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.primary,
      textAlign: "center",
    },
    tapHintSub: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: spacing.xs,
    },
    timerDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.danger,
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
      shadowColor: colors.textPrimary,
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
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 6,
    },
    promptText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.primaryOn,
      marginLeft: spacing.xs,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: spacing.lg,
      textAlign: "center",
    },
  });
