import { Audio } from "expo-av";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { simulationApi } from "../api/services";
import { transcribeAudio } from "../api/speechApi";
import { ttsService } from "../services/textToSpeechService";
import type {
  ColorTokens,
} from "../theme/tokens";
import { colors as palette, radii, shadows, spacing } from "../theme/tokens";
import type {
  PracticeFeedback,
  SimulationPart,
  SimulationRuntimeResponse,
  SimulationStart,
  SpeakingSessionSegment,
  TestSimulation,
  TestSimulationRuntime,
  TestSimulationRuntimeState,
  TestSimulationTurnRecord,
} from "../types/api";
import { logger } from "../utils/logger";

type TestProps = {
  onComplete: (results: any) => void;
  onExit: () => void;
};

type TurnState =
  | "idle"
  | "recording"
  | "transcribing"
  | "submitting"
  | "scoring";

type LocalPauseStep = "synthesis" | "transcription" | "submission";

type LocalPauseState = {
  step: LocalPauseStep;
  message: string;
  terminal?: boolean;
};

const EXAMINER_RUNTIME_STATES: TestSimulationRuntimeState[] = [
  "intro-examiner",
  "part1-examiner",
  "part1-transition",
  "part2-intro",
  "part2-prep",
  "part2-examiner-launch",
  "part2-transition",
  "part3-intro",
  "part3-examiner",
  "evaluation",
];

const CANDIDATE_RUNTIME_STATES: TestSimulationRuntimeState[] = [
  "intro-candidate-turn",
  "part1-candidate-turn",
  "part2-candidate-turn",
  "part3-candidate-turn",
];

const isExaminerRuntimeState = (state?: TestSimulationRuntimeState | null) =>
  Boolean(state && EXAMINER_RUNTIME_STATES.includes(state));

const isCandidateRuntimeState = (state?: TestSimulationRuntimeState | null) =>
  Boolean(state && CANDIDATE_RUNTIME_STATES.includes(state));

const isRetryableRuntimeState = (state?: TestSimulationRuntimeState | null) =>
  state === "paused-retryable";

const isTerminalRuntimeState = (state?: TestSimulationRuntimeState | null) =>
  state === "failed-terminal";

const resolvePartLabel = (partNumber: number) => {
  if (partNumber <= 0) {
    return "Check-in";
  }
  return `Part ${partNumber}`;
};

const buildSegmentKey = (session: SimulationStart) => {
  const runtime = session.runtime;
  const segment = runtime.currentSegment;
  return [
    session.simulationId,
    runtime.state,
    runtime.currentPart,
    runtime.currentTurnIndex,
    runtime.retryCount,
    segment.kind,
    segment.phraseId || "",
    segment.text || "",
  ].join("::");
};

const mergeRuntimeIntoSession = (
  session: SimulationStart,
  response: SimulationRuntimeResponse
): SimulationStart => ({
  ...session,
  runtime: response.runtime,
  sessionPackage: response.sessionPackage || session.sessionPackage,
});

const resolvePackageSegment = (
  session: SimulationStart | null
): SpeakingSessionSegment | null => {
  if (!session?.sessionPackage?.segments?.length) {
    return null;
  }

  const { runtime } = session;
  const { currentSegment } = runtime;
  const segments = session.sessionPackage.segments;

  if (currentSegment.phraseId) {
    return (
      segments.find((segment) => segment.phraseId === currentSegment.phraseId) ||
      null
    );
  }

  const promptText = currentSegment.text?.trim();
  if (!promptText) {
    return null;
  }

  const promptIndex =
    typeof runtime.seedQuestionIndex === "number"
      ? runtime.seedQuestionIndex
      : runtime.currentTurnIndex || 0;

  return (
    segments.find(
      (segment) =>
        segment.text.trim() === promptText &&
        segment.part === runtime.currentPart &&
        (typeof segment.promptIndex === "number"
          ? segment.promptIndex === promptIndex
          : true)
    ) || null
  );
};

const getUpcomingPackageSegments = (
  session: SimulationStart | null,
  count: number
) => {
  if (!session?.sessionPackage?.segments?.length) {
    return [];
  }

  const examinerSegments = session.sessionPackage.segments.filter(
    (segment) => segment.turnType === "examiner" && Boolean(segment.audioUrl)
  );
  const currentSegment = resolvePackageSegment(session);
  if (!currentSegment) {
    return examinerSegments.slice(0, count);
  }

  const currentIndex = examinerSegments.findIndex(
    (segment) => segment.segmentId === currentSegment.segmentId
  );
  if (currentIndex < 0) {
    return examinerSegments.slice(0, count);
  }

  return examinerSegments.slice(currentIndex + 1, currentIndex + 1 + count);
};

const buildCompletionPayload = (session: SimulationStart) => {
  const turnHistory = session.runtime.turnHistory || [];

  return session.parts.map((part) => {
    const partTurns = turnHistory.filter((turn) => turn.part === part.part);
    return {
      part: part.part,
      question: part.question,
      response: partTurns
        .map((turn) => turn.transcript?.trim())
        .filter((value): value is string => Boolean(value))
        .join("\n\n"),
      timeSpent: partTurns.reduce(
        (total, turn) => total + (turn.durationSeconds || 0),
        0
      ),
    };
  });
};

const buildFullTranscript = (turnHistory: TestSimulationTurnRecord[] = []) => {
  return turnHistory
    .map((turn, index) => {
      const partLabel = turn.part > 0 ? `Part ${turn.part}` : "Check-in";
      const candidateLine =
        typeof turn.transcript === "string" && turn.transcript.trim().length > 0
          ? turn.transcript.trim()
          : "[No transcript captured]";

      return `${partLabel} - Turn ${index + 1}\nExaminer: ${turn.prompt}\nCandidate: ${candidateLine}`;
    })
    .join("\n\n");
};

const buildPartScores = (parts: TestSimulation["parts"] = []) => {
  const scores: Record<string, number> = {};
  parts.forEach((part) => {
    const band = part.feedback?.overallBand;
    if (typeof band === "number" && Number.isFinite(band)) {
      scores[`part${part.part}`] = band;
    }
  });
  return Object.keys(scores).length ? scores : undefined;
};

const buildCriterionFeedback = (
  band: number | undefined,
  summary: string,
  strengths: string[],
  improvements: string[]
) => ({
  band: typeof band === "number" ? band : 0,
  feedback: summary,
  strengths,
  improvements,
  detailedExamples: [],
  linkingPhrases: [],
  vocabularyAlternatives: [],
  collocations: [],
});

const buildEvaluationPayload = (
  completed: TestSimulation,
  turnHistory: TestSimulationTurnRecord[]
) => {
  const feedback: PracticeFeedback | undefined = completed.overallFeedback;
  const strengths = Array.isArray(feedback?.strengths) ? feedback?.strengths : [];
  const improvements = Array.isArray(feedback?.improvements)
    ? feedback?.improvements
    : [];
  const breakdown = feedback?.bandBreakdown || {};
  const summary = feedback?.summary || "Your full speaking simulation is ready.";

  return {
    overallBand:
      typeof completed.overallBand === "number"
        ? completed.overallBand
        : typeof feedback?.overallBand === "number"
        ? feedback.overallBand
        : 0,
    spokenSummary: summary,
    criteria: {
      fluencyCoherence: buildCriterionFeedback(
        breakdown.fluency,
        summary,
        strengths,
        improvements
      ),
      lexicalResource: buildCriterionFeedback(
        breakdown.lexicalResource,
        summary,
        strengths,
        improvements
      ),
      grammaticalRange: buildCriterionFeedback(
        breakdown.grammaticalRange,
        summary,
        strengths,
        improvements
      ),
      pronunciation: buildCriterionFeedback(
        breakdown.pronunciation,
        summary,
        strengths,
        improvements
      ),
    },
    corrections: [],
    suggestions: improvements,
    partScores: buildPartScores(completed.parts),
    fullTranscript: buildFullTranscript(turnHistory),
  };
};

const buildCompletionResult = (
  session: SimulationStart,
  completed: TestSimulation
) => {
  const turnHistory = session.runtime.turnHistory || [];
  const evaluation = buildEvaluationPayload(completed, turnHistory);

  return {
    testSessionId: completed._id || session.simulationId,
    timestamp:
      completed.completedAt || completed.updatedAt || new Date().toISOString(),
    duration: turnHistory.reduce(
      (total, turn) => total + (turn.durationSeconds || 0),
      0
    ),
    overallBand: evaluation.overallBand,
    spokenSummary: evaluation.spokenSummary,
    partScores: evaluation.partScores,
    fullTranscript: evaluation.fullTranscript,
    evaluation,
    questions: session.parts.map((part) => ({
      questionId: part.topicId,
      question: part.question,
      category: `part${part.part}`,
      topic: part.topicTitle,
    })),
  };
};

const getCandidatePrompt = (
  runtime: TestSimulationRuntime,
  currentPart?: SimulationPart
) => {
  switch (runtime.state) {
    case "intro-candidate-turn":
      return "Respond to the examiner with your full name clearly before the test begins.";
    case "part2-candidate-turn":
      return (
        currentPart?.question ||
        runtime.currentSegment.text ||
        "Deliver your long answer for Part 2."
      );
    case "part1-candidate-turn":
    case "part3-candidate-turn":
      return (
        runtime.currentSegment.text ||
        currentPart?.question ||
        "Answer the examiner clearly and naturally."
      );
    default:
      return currentPart?.question || runtime.currentSegment.text || "";
  }
};

const getMicErrorMessage = (error: unknown) => {
  const name = String((error as { name?: string } | undefined)?.name || "");
  const message = (error as { message?: string } | undefined)?.message;

  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone permission was denied. Restart the simulation and allow microphone access.";
  }
  if (name === "NotFoundError") {
    return "No microphone was found on this device. Connect one and restart the simulation.";
  }
  if (name === "NotReadableError") {
    return "Your microphone is already in use by another app. Close the other app and retry this step.";
  }

  return message || "Microphone access failed for this simulation step.";
};

type ActionButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  variant?: "primary" | "secondary" | "ghost";
};

const ActionButton: React.FC<ActionButtonProps> = ({
  title,
  onPress,
  disabled,
  testID,
  variant = "primary",
}) => {
  const styles = sharedStyles;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={[
        styles.buttonBase,
        variant === "primary"
          ? styles.buttonPrimary
          : variant === "secondary"
          ? styles.buttonSecondary
          : styles.buttonGhost,
        disabled ? styles.buttonDisabled : undefined,
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          variant === "ghost" ? styles.buttonGhostLabel : undefined,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
};

export const AuthenticFullTestV2: React.FC<TestProps> = ({
  onComplete,
  onExit,
}) => {
  const styles = sharedStyles;

  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState<SimulationStart | null>(null);
  const [turnState, setTurnState] = useState<TurnState>("idle");
  const [playbackState, setPlaybackState] = useState<
    "idle" | "loading-package" | "speaking" | "ready"
  >("idle");
  const [promptReady, setPromptReady] = useState(false);
  const [localPause, setLocalPause] = useState<LocalPauseState | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState("");

  const mountedRef = useRef(true);
  const sessionRef = useRef<SimulationStart | null>(null);
  const recordingRef = useRef<any>(null);
  const lastSegmentKeyRef = useRef("");
  const lastPromptRef = useRef("");
  const pendingAudioUriRef = useRef<string | null>(null);
  const pendingDurationRef = useRef<number>(0);
  const pendingTranscriptRef = useRef("");
  const turnStartedAtRef = useRef<number | null>(null);
  const localRetryBudgetRef = useRef(1);

  const runtime = session?.runtime ?? null;
  const currentPart = useMemo(() => {
    if (!session || !runtime) {
      return undefined;
    }
    return session.parts.find((part) => part.part === runtime.currentPart);
  }, [runtime, session]);
  const activePackageSegment = useMemo(
    () => resolvePackageSegment(session),
    [session]
  );

  const isExaminerTurn = Boolean(runtime && isExaminerRuntimeState(runtime.state));
  const isCandidateTurn = Boolean(
    runtime && isCandidateRuntimeState(runtime.state)
  );
  const isRetryablePause = Boolean(
    runtime && isRetryableRuntimeState(runtime.state)
  );
  const isTerminalPause = Boolean(
    runtime && isTerminalRuntimeState(runtime.state)
  );

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const cleanupRecording = useCallback(async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {
        // Ignore cleanup noise when a recording is already stopped.
      } finally {
        recordingRef.current = null;
      }
    }
  }, []);

  const cleanupPlayback = useCallback(async () => {
    try {
      await ttsService.stop();
    } catch {
      // Ignore TTS cleanup issues on exit.
    }
  }, []);

  const cleanupAll = useCallback(async () => {
    await cleanupRecording();
    await cleanupPlayback();
  }, [cleanupPlayback, cleanupRecording]);

  const hydrateRuntime = useCallback(
    (response: SimulationRuntimeResponse) => {
      const base = sessionRef.current;
      if (!base) {
        return;
      }

      const merged = mergeRuntimeIntoSession(base, response);
      sessionRef.current = merged;
      setSession(merged);
      setTurnState("idle");
      setLocalPause(null);
      localRetryBudgetRef.current = 1;
    },
    []
  );

  const initializeSimulation = useCallback(async () => {
    setBooting(true);
    setBootError(null);
    setLocalPause(null);
    setPromptReady(false);
    setPlaybackState("idle");
    setTurnState("idle");
    setLastTranscript("");
    lastSegmentKeyRef.current = "";
    pendingAudioUriRef.current = null;
    pendingTranscriptRef.current = "";
    pendingDurationRef.current = 0;
    localRetryBudgetRef.current = 1;

    try {
      await cleanupAll();
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        throw new Error("Microphone permission is required to take the speaking simulation.");
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
        duckOthers: false,
      } as any);

      const started = await simulationApi.start();
      if (!mountedRef.current) {
        return;
      }

      const hydrated =
        started.runtime && started.sessionPackage
          ? started
          : mergeRuntimeIntoSession(
              started,
              await simulationApi.getRuntime(started.simulationId)
            );

      sessionRef.current = hydrated;
      setSession(hydrated);
    } catch (error: any) {
      logger.warn("Failed to start authentic speaking simulation", error);
      if (!mountedRef.current) {
        return;
      }
      setBootError(
        error?.message ||
          "We could not start the full speaking simulation right now."
      );
    } finally {
      if (mountedRef.current) {
        setBooting(false);
      }
    }
  }, [cleanupAll]);

  useEffect(() => {
    void initializeSimulation();

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onExit();
        return true;
      }
    );

    return () => {
      mountedRef.current = false;
      backHandler.remove();
      void cleanupAll();
    };
  }, [cleanupAll, initializeSimulation, onExit]);

  useEffect(() => {
    if (!session || !runtime || !isExaminerTurn || localPause) {
      setPromptReady(false);
      setPlaybackState("idle");
      return;
    }

    const segmentKey = buildSegmentKey(session);
    if (lastSegmentKeyRef.current === segmentKey) {
      return;
    }

    lastSegmentKeyRef.current = segmentKey;
    localRetryBudgetRef.current = 1;
    const promptText = runtime.currentSegment.text?.trim();
    lastPromptRef.current = promptText || "";

    if (!promptText) {
      setPlaybackState("ready");
      setPromptReady(true);
      return;
    }

    let cancelled = false;

    const playSegment = async () => {
      setPromptReady(false);
      setPlaybackState(
        activePackageSegment?.audioUrl ? "loading-package" : "speaking"
      );

      try {
        const onDone = () => {
          if (cancelled || !mountedRef.current) {
            return;
          }
          setPlaybackState("ready");
          setPromptReady(true);
        };

        if (activePackageSegment?.audioUrl) {
          setPlaybackState("loading-package");
          await ttsService.speakPackageAudio(activePackageSegment.audioUrl, {
            onDone,
          });
        } else {
          setPlaybackState("speaking");
          await ttsService.speak(promptText, {
            onDone,
          });
        }
      } catch (error: any) {
        if (cancelled || !mountedRef.current) {
          return;
        }

        const message =
          error?.message || "Examiner audio failed for the current prompt.";
        if (localRetryBudgetRef.current <= 0) {
          setLocalPause({
            step: "synthesis",
            message,
            terminal: true,
          });
        } else {
          localRetryBudgetRef.current -= 1;
          setLocalPause({
            step: "synthesis",
            message,
          });
        }
        setPlaybackState("idle");
      }
    };

    void playSegment();

    return () => {
      cancelled = true;
    };
  }, [activePackageSegment, isExaminerTurn, localPause, runtime, session]);

  useEffect(() => {
    if (!session?.sessionPackage) {
      return;
    }

    const segmentsToPreload = [
      activePackageSegment,
      ...getUpcomingPackageSegments(session, 2),
    ].filter(
      (candidate): candidate is SpeakingSessionSegment =>
        Boolean(candidate?.audioUrl)
    );

    for (const nextSegment of segmentsToPreload) {
      void ttsService.preloadPackageAudio(nextSegment.audioUrl).catch(() => {
        // Speculative preload failures should not interrupt the active turn.
      });
    }
  }, [activePackageSegment, session]);

  const answerRuntime = useCallback(
    async (transcript: string, durationSeconds: number) => {
      const activeSession = sessionRef.current;
      if (!activeSession) {
        return;
      }

      setTurnState("submitting");
      pendingTranscriptRef.current = transcript;
      setLastTranscript(transcript);

      try {
        const response = await simulationApi.answerRuntime(
          activeSession.simulationId,
          {
            transcript,
            durationSeconds,
          }
        );
        if (!mountedRef.current) {
          return;
        }
        hydrateRuntime(response);
      } catch (error: any) {
        logger.warn("Failed to submit runtime answer", error);
        const message =
          error?.message || "Failed to submit this speaking turn.";
        if (localRetryBudgetRef.current <= 0) {
          setLocalPause({
            step: "submission",
            message,
            terminal: true,
          });
        } else {
          localRetryBudgetRef.current -= 1;
          setLocalPause({
            step: "submission",
            message,
          });
        }
        setTurnState("idle");
      }
    },
    [hydrateRuntime]
  );

  const transcribeAndSubmit = useCallback(
    async (audioUri: string, durationSeconds: number) => {
      pendingAudioUriRef.current = audioUri;
      pendingDurationRef.current = durationSeconds;
      setTurnState("transcribing");

      try {
        const transcription = await transcribeAudio(audioUri);
        const transcript = transcription.text?.trim();
        const resolvedDuration =
          typeof transcription.duration === "number" &&
          Number.isFinite(transcription.duration)
            ? Math.max(1, Math.round(transcription.duration))
            : durationSeconds;

        if (!transcript) {
          throw new Error(
            "The recording finished, but no transcript was returned."
          );
        }

        await answerRuntime(transcript, resolvedDuration);
      } catch (error: any) {
        logger.warn("Failed to transcribe recorded answer", error);
        const message =
          error?.message ||
          "Transcription failed for the current speaking turn.";
        if (localRetryBudgetRef.current <= 0) {
          setLocalPause({
            step: "transcription",
            message,
            terminal: true,
          });
        } else {
          localRetryBudgetRef.current -= 1;
          setLocalPause({
            step: "transcription",
            message,
          });
        }
        setTurnState("idle");
      }
    },
    [answerRuntime]
  );

  const startRecordingTurn = useCallback(async () => {
    if (!runtime || !isCandidateRuntimeState(runtime.state)) {
      return;
    }

    setLocalPause(null);
    localRetryBudgetRef.current = 1;
    setLastTranscript("");

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
      } as any);

      const recordingPreset =
        (Audio as any).RecordingOptionsPresets?.HIGH_QUALITY || {};
      const created = await Audio.Recording.createAsync(recordingPreset);

      recordingRef.current = created.recording;
      turnStartedAtRef.current = Date.now();
      setTurnState("recording");
    } catch (error) {
      logger.warn("Failed to start recording", error);
      const message = getMicErrorMessage(error);
      setLocalPause({
        step: "submission",
        message,
      });
      setTurnState("idle");
    }
  }, [runtime]);

  const stopRecordingTurn = useCallback(async () => {
    const activeRecording = recordingRef.current;
    if (!activeRecording) {
      return;
    }

    recordingRef.current = null;
    try {
      await activeRecording.stopAndUnloadAsync();
      const audioUri = activeRecording.getURI?.();
      const elapsedSeconds = Math.max(
        1,
        Math.round(
          ((Date.now() - (turnStartedAtRef.current || Date.now())) / 1000) || 1
        )
      );
      turnStartedAtRef.current = null;

      if (!audioUri) {
        throw new Error("The recording finished, but no audio file was produced.");
      }

      await transcribeAndSubmit(audioUri, elapsedSeconds);
    } catch (error: any) {
      logger.warn("Failed while stopping recording", error);
      const message =
        error?.message || "We could not process this recorded answer.";
      setLocalPause({
        step: "submission",
        message,
      });
      setTurnState("idle");
    }
  }, [transcribeAndSubmit]);

  const continueAfterPrompt = useCallback(async () => {
    const activeSession = sessionRef.current;
    const activeRuntime = activeSession?.runtime;
    if (!activeSession || !activeRuntime) {
      return;
    }

    if (activeRuntime.state === "evaluation") {
      setTurnState("scoring");
      try {
        const completed = await simulationApi.complete(
          activeSession.simulationId,
          buildCompletionPayload(activeSession)
        );
        if (!mountedRef.current) {
          return;
        }
        await onComplete(buildCompletionResult(activeSession, completed));
      } catch (error: any) {
        logger.warn("Failed to complete authentic simulation", error);
        setTurnState("idle");
        setLocalPause({
          step: "submission",
          message:
            error?.message ||
            "We could not finalize the speaking simulation.",
          terminal: true,
        });
      }
      return;
    }

    try {
      const response = await simulationApi.advanceRuntime(
        activeSession.simulationId
      );
      if (!mountedRef.current) {
        return;
      }
      hydrateRuntime(response);
    } catch (error: any) {
      logger.warn("Failed to advance simulation runtime", error);
      setLocalPause({
        step: "submission",
        message:
          error?.message ||
          "We could not move to the next step of the simulation.",
        terminal: true,
      });
    }
  }, [hydrateRuntime, onComplete]);

  const retryCurrentStep = useCallback(async () => {
    const activeSession = sessionRef.current;
    if (!activeSession) {
      return;
    }

    if (runtime && isRetryableRuntimeState(runtime.state)) {
      try {
        const response = await simulationApi.retryRuntime(
          activeSession.simulationId
        );
        if (!mountedRef.current) {
          return;
        }
        hydrateRuntime(response);
      } catch (error: any) {
        logger.warn("Failed to retry backend runtime step", error);
        setLocalPause({
          step: "submission",
          message:
            error?.message || "We could not retry the current simulation step.",
          terminal: true,
        });
      }
      return;
    }

    if (!localPause) {
      return;
    }

    setLocalPause(null);

    if (localPause.step === "synthesis") {
      lastSegmentKeyRef.current = "";
      setPromptReady(false);
      setPlaybackState("idle");
      return;
    }

    if (
      localPause.step === "transcription" &&
      pendingAudioUriRef.current &&
      pendingDurationRef.current > 0
    ) {
      await transcribeAndSubmit(
        pendingAudioUriRef.current,
        pendingDurationRef.current
      );
      return;
    }

    if (
      localPause.step === "submission" &&
      pendingTranscriptRef.current.trim().length > 0
    ) {
      await answerRuntime(
        pendingTranscriptRef.current,
        pendingDurationRef.current
      );
      return;
    }

    await initializeSimulation();
  }, [
    answerRuntime,
    hydrateRuntime,
    initializeSimulation,
    localPause,
    runtime,
    transcribeAndSubmit,
  ]);

  const currentPartChip = runtime ? resolvePartLabel(runtime.currentPart) : "Part 1";
  const progressTone = useMemo(() => {
    const activePart = runtime?.currentPart || 0;
    return [1, 2, 3].map((part) => ({
      part,
      active: activePart === part,
      complete: activePart > part || runtime?.state === "evaluation",
    }));
  }, [runtime?.currentPart, runtime?.state]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.background} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>AUTHENTIC SIMULATION</Text>
            <Text style={styles.title}>Full IELTS Speaking Test</Text>
            <Text style={styles.subtitle}>
              Follow the examiner-led test flow. Recording only unlocks when it is your turn to answer.
            </Text>
          </View>
          <ActionButton title="Exit test" onPress={onExit} variant="ghost" />
        </View>

        {booting ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={palette.primary} />
            <Text style={styles.loadingTitle}>Preparing your simulation</Text>
            <Text style={styles.loadingBody}>
              We are opening the examiner-led test and reserving all three speaking parts.
            </Text>
          </View>
        ) : null}

        {!booting && bootError ? (
          <View style={styles.pauseCard}>
            <Text style={styles.pauseTitle}>We could not start the test</Text>
            <Text style={styles.pauseBody}>{bootError}</Text>
            <View style={styles.buttonRow}>
              <ActionButton
                title="Try again"
                onPress={() => {
                  void initializeSimulation();
                }}
              />
              <ActionButton title="Exit test" onPress={onExit} variant="ghost" />
            </View>
          </View>
        ) : null}

        {session && !booting ? (
          <View style={styles.stageCard}>
            <View style={styles.stageHeader}>
              <View>
                <Text style={styles.stageTitle}>Simulation in Progress</Text>
                <Text style={styles.stageSubtitle}>
                  {isExaminerTurn
                    ? "Listen to the examiner first."
                    : isCandidateTurn
                    ? "It is your turn to answer."
                    : "Stay in the guided examiner flow."}
                </Text>
              </View>
              <View style={styles.stageHeaderMeta}>
                <View style={styles.partChip}>
                  <Text style={styles.partChipLabel}>{currentPartChip}</Text>
                </View>
              </View>
            </View>

            <View style={styles.progressRow}>
              {progressTone.map((entry) => (
                <View
                  key={entry.part}
                  style={[
                    styles.progressChip,
                    entry.active
                      ? styles.progressChipActive
                      : entry.complete
                      ? styles.progressChipComplete
                      : undefined,
                  ]}
                >
                  <Text
                    style={[
                      styles.progressChipLabel,
                      entry.active
                        ? styles.progressChipLabelActive
                        : entry.complete
                        ? styles.progressChipLabelComplete
                        : undefined,
                    ]}
                  >
                    Part {entry.part}
                  </Text>
                </View>
              ))}
            </View>

            {isRetryablePause || localPause ? (
              <View style={styles.pauseCard}>
                <Text style={styles.pauseTitle}>
                  {isTerminalPause || localPause?.terminal
                    ? "Simulation needs restart"
                    : "Simulation paused"}
                </Text>
                <Text style={styles.pauseBody}>
                  {runtime?.lastError ||
                    localPause?.message ||
                    "The current simulation step failed."}
                </Text>
                <View style={styles.buttonRow}>
                  {!isTerminalPause && !localPause?.terminal ? (
                    <ActionButton
                      title="Retry step"
                      onPress={() => {
                        void retryCurrentStep();
                      }}
                    />
                  ) : null}
                  <ActionButton
                    title="Start a new simulation"
                    variant="ghost"
                    onPress={() => {
                      void initializeSimulation();
                    }}
                  />
                </View>
              </View>
            ) : null}

            {!isRetryablePause && !localPause && isExaminerTurn ? (
              <View style={styles.turnCard}>
                <Text style={styles.turnBadge}>Examiner turn</Text>
                <Text style={styles.turnHeading}>Examiner speaking</Text>
                <Text style={styles.turnBody}>
                  {runtime?.currentSegment.text ||
                    "The examiner is preparing the next instruction."}
                </Text>
                {currentPart?.topicTitle ? (
                  <View style={styles.topicCard}>
                    <Text style={styles.topicLabel}>Topic</Text>
                    <Text style={styles.topicValue}>{currentPart.topicTitle}</Text>
                  </View>
                ) : null}
                <View style={styles.buttonRow}>
                  <ActionButton
                    title="Start Recording"
                    onPress={() => undefined}
                    disabled
                    testID="start-recording-button"
                  />
                  <ActionButton
                    title={
                      runtime?.state === "evaluation"
                        ? "Score full simulation"
                        : "Continue after prompt"
                    }
                    onPress={() => {
                      void continueAfterPrompt();
                    }}
                    disabled={!promptReady || turnState === "scoring"}
                    variant="secondary"
                  />
                </View>
                <Text style={styles.helperText}>
                  {turnState === "scoring"
                    ? "Scoring the full simulation..."
                    : playbackState === "loading-package"
                    ? "Loading examiner prompt..."
                    : playbackState === "speaking"
                    ? "Examiner audio is playing now."
                    : promptReady
                    ? "Prompt finished. Continue when you are ready."
                    : "Preparing examiner audio..."}
                </Text>
              </View>
            ) : null}

            {!isRetryablePause && !localPause && isCandidateTurn ? (
              <View style={styles.turnCard}>
                <Text style={styles.turnBadge}>Candidate turn</Text>
                <Text style={styles.turnHeading}>Your turn</Text>
                <Text style={styles.turnBody}>
                  {runtime ? getCandidatePrompt(runtime, currentPart) : ""}
                </Text>
                <View style={styles.buttonRow}>
                  <ActionButton
                    title="Start Recording"
                    onPress={() => {
                      void startRecordingTurn();
                    }}
                    disabled={turnState !== "idle"}
                    testID="start-recording-button"
                  />
                  <ActionButton
                    title="Stop + Submit"
                    onPress={() => {
                      void stopRecordingTurn();
                    }}
                    disabled={turnState !== "recording"}
                    variant="ghost"
                  />
                </View>
                <Text style={styles.helperText}>
                  {turnState === "recording"
                    ? "Recording in progress."
                    : turnState === "transcribing"
                    ? "Transcribing your answer..."
                    : turnState === "submitting"
                    ? "Sending your answer to the examiner..."
                    : "Recording unlocks only during your turn."}
                </Text>
                {lastTranscript ? (
                  <View style={styles.transcriptCard}>
                    <Text style={styles.topicLabel}>Latest transcript captured</Text>
                    <Text style={styles.transcriptBody}>{lastTranscript}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.backgroundMuted,
    },
    scrollContent: {
      padding: spacing.lg,
      gap: spacing.lg,
    },
    headerRow: {
      gap: spacing.md,
    },
    headerCopy: {
      gap: spacing.xs,
    },
    eyebrow: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1.4,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 30,
      fontWeight: "800",
    },
    subtitle: {
      color: colors.textMutedStrong,
      fontSize: 16,
      lineHeight: 24,
    },
    loadingCard: {
      borderRadius: radii.xxl,
      padding: spacing.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      alignItems: "center",
      gap: spacing.sm,
      ...shadows.card,
    },
    loadingTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "700",
    },
    loadingBody: {
      color: colors.textMutedStrong,
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
    },
    stageCard: {
      borderRadius: radii.xxl,
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 2,
      borderColor: colors.border,
      padding: spacing.xl,
      gap: spacing.lg,
    },
    stageHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: spacing.md,
    },
    stageHeaderMeta: {
      alignItems: "flex-end",
    },
    stageTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "800",
    },
    stageSubtitle: {
      color: colors.textMutedStrong,
      fontSize: 14,
      lineHeight: 20,
      marginTop: spacing.xs,
    },
    partChip: {
      borderRadius: radii.full,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderWidth: 1,
      borderColor: colors.borderMuted,
    },
    partChipLabel: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "700",
    },
    progressRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    progressChip: {
      borderRadius: radii.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderMuted,
    },
    progressChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    progressChipComplete: {
      backgroundColor: colors.successSoft,
      borderColor: colors.success,
    },
    progressChipLabel: {
      color: colors.textMutedStrong,
      fontSize: 15,
      fontWeight: "700",
    },
    progressChipLabelActive: {
      color: colors.primaryOn,
    },
    progressChipLabelComplete: {
      color: colors.successOn,
    },
    turnCard: {
      borderRadius: radii.xxl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      padding: spacing.xl,
      gap: spacing.md,
      ...shadows.card,
    },
    turnBadge: {
      alignSelf: "flex-start",
      backgroundColor: colors.primarySoft,
      color: colors.primaryStrong,
      borderRadius: radii.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      fontSize: 13,
      fontWeight: "700",
    },
    turnHeading: {
      color: colors.textPrimary,
      fontSize: 28,
      fontWeight: "800",
    },
    turnBody: {
      color: colors.textSecondary,
      fontSize: 17,
      lineHeight: 26,
    },
    topicCard: {
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      backgroundColor: colors.backgroundMuted,
      padding: spacing.md,
      gap: spacing.xs,
    },
    topicLabel: {
      color: colors.textMutedStrong,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    topicValue: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "700",
      lineHeight: 24,
    },
    transcriptCard: {
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      backgroundColor: colors.backgroundMuted,
      padding: spacing.md,
      gap: spacing.sm,
    },
    transcriptBody: {
      color: colors.textPrimary,
      fontSize: 15,
      lineHeight: 24,
    },
    pauseCard: {
      borderRadius: radii.xxl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.warning,
      padding: spacing.xl,
      gap: spacing.md,
      ...shadows.card,
    },
    pauseTitle: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "800",
    },
    pauseBody: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 24,
    },
    helperText: {
      color: colors.textMutedStrong,
      fontSize: 14,
      lineHeight: 20,
    },
    buttonRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    buttonBase: {
      minHeight: 48,
      borderRadius: radii.full,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 160,
    },
    buttonPrimary: {
      backgroundColor: colors.primary,
    },
    buttonSecondary: {
      backgroundColor: colors.textPrimary,
    },
    buttonGhost: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderMuted,
    },
    buttonDisabled: {
      opacity: 0.45,
    },
    buttonLabel: {
      color: colors.primaryOn,
      fontSize: 16,
      fontWeight: "700",
    },
    buttonGhostLabel: {
      color: colors.textPrimary,
    },
  });

const sharedStyles = createStyles(palette);
