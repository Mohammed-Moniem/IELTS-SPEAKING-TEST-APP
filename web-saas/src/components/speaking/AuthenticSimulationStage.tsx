'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { StatusBadge } from '@/components/ui/v2';
import { ApiError } from '@/lib/api/client';
import {
  LiveSimulationSession,
  advanceSimulationRuntime,
  completeSimulationRuntime,
  decodeAudioBase64,
  isCandidateRuntimeState,
  isExaminerRuntimeState,
  isRetryablePauseState,
  isTerminalRuntimeState,
  mergeRuntimeIntoSimulation,
  retrySimulationRuntimeStep,
  submitSimulationRuntimeAnswer,
  synthesizeSimulationSegment,
  transcribeSimulationAudio
} from '@/lib/speaking/simulationRuntime';
import { SimulationSession } from '@/lib/types';

type AuthenticSimulationStageProps = {
  audioContextRef: React.MutableRefObject<AudioContext | null>;
  devices: MediaDeviceInfo[];
  deviceId: string;
  elapsed: number;
  onComplete: (result: SimulationSession) => Promise<void> | void;
  onDeviceChange: (deviceId: string) => void;
  onRestart: () => Promise<void> | void;
  onSessionChange: (session: LiveSimulationSession | null) => void;
  onStart: () => Promise<void> | void;
  session: LiveSimulationSession | null;
  starting: boolean;
  workspaceRef: React.RefObject<HTMLElement | null>;
};

type TurnState = 'idle' | 'recording' | 'transcribing' | 'submitting' | 'scoring';
type LocalPause = {
  step: 'synthesis' | 'transcription' | 'submission' | 'advance';
  message: string;
};

const getMicErrorMessage = (error: unknown) => {
  const name = String((error as { name?: string } | undefined)?.name || '');
  const message = (error as { message?: string } | undefined)?.message;

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Microphone permission was denied. Restart the simulation and allow microphone access.';
  }
  if (name === 'NotFoundError') {
    return 'No microphone device was found. Connect a microphone, then restart the simulation.';
  }
  if (name === 'NotReadableError') {
    return 'Your microphone is already in use by another app. Close the other app and retry this step.';
  }

  return message || 'Microphone access failed for this simulation step.';
};

const buildSegmentKey = (session: LiveSimulationSession) => {
  const segment = session.runtime.currentSegment;
  return [
    session.simulationId,
    session.runtime.state,
    session.runtime.currentPart,
    session.runtime.currentTurnIndex,
    segment.kind,
    segment.phraseId || '',
    segment.text || ''
  ].join('::');
};

const resolvePartLabel = (partNumber: number) => {
  if (partNumber <= 0) return 'Check-in';
  return `Part ${partNumber}`;
};

export default function AuthenticSimulationStage({
  audioContextRef,
  devices,
  deviceId,
  elapsed,
  onComplete,
  onDeviceChange,
  onRestart,
  onSessionChange,
  onStart,
  session,
  starting,
  workspaceRef
}: AuthenticSimulationStageProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const currentBufferSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const promptCompletionTimeoutRef = useRef<number | null>(null);
  const autoAdvanceTimeoutRef = useRef<number | null>(null);
  const prepCountdownIntervalRef = useRef<number | null>(null);
  const lastSegmentKeyRef = useRef('');
  const lastAutoAdvanceKeyRef = useRef('');
  const pendingAudioBlobRef = useRef<Blob | null>(null);
  const pendingDurationRef = useRef<number>(0);
  const pendingTranscriptRef = useRef<string>('');
  const turnStartedAtRef = useRef<number | null>(null);

  const [turnState, setTurnState] = useState<TurnState>('idle');
  const [playbackState, setPlaybackState] = useState<'idle' | 'synthesizing' | 'playing' | 'ready'>('idle');
  const [promptReady, setPromptReady] = useState(false);
  const [localPause, setLocalPause] = useState<LocalPause | null>(null);
  const [lastTranscript, setLastTranscript] = useState('');
  const [part2PrepRemaining, setPart2PrepRemaining] = useState<number | null>(null);

  const runtime = session?.runtime ?? null;
  const segment = runtime?.currentSegment ?? null;

  const currentPart = useMemo(() => {
    if (!session || !runtime) return undefined;
    return session.parts.find(part => part.part === runtime.currentPart);
  }, [runtime, session]);

  const isExaminerTurn = Boolean(runtime && isExaminerRuntimeState(runtime.state));
  const isCandidateTurn = Boolean(runtime && isCandidateRuntimeState(runtime.state));
  const isBackendPause = Boolean(runtime && isRetryablePauseState(runtime.state));
  const isBackendTerminal = Boolean(runtime && isTerminalRuntimeState(runtime.state));
  const effectivePauseMessage = isBackendPause
    ? runtime?.lastError || 'The simulation paused because the current step failed.'
    : localPause?.message;

  const currentPartChip = runtime ? resolvePartLabel(runtime.currentPart) : 'Part 1';
  const canStartRecording = isCandidateTurn && turnState === 'idle' && !localPause;
  const canStopRecording = turnState === 'recording';
  const shouldAutoAdvanceAfterPrompt = Boolean(runtime && isExaminerRuntimeState(runtime.state));

  const clearPromptCompletionTimeout = useCallback(() => {
    if (promptCompletionTimeoutRef.current) {
      window.clearTimeout(promptCompletionTimeoutRef.current);
      promptCompletionTimeoutRef.current = null;
    }
  }, []);

  const clearAutoAdvanceTimeout = useCallback(() => {
    if (autoAdvanceTimeoutRef.current) {
      window.clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
  }, []);

  const clearPrepCountdown = useCallback(() => {
    if (prepCountdownIntervalRef.current) {
      window.clearInterval(prepCountdownIntervalRef.current);
      prepCountdownIntervalRef.current = null;
    }
    setPart2PrepRemaining(null);
  }, []);

  const markPromptReady = useCallback(() => {
    clearPromptCompletionTimeout();
    setPlaybackState('ready');
    setPromptReady(true);
  }, [clearPromptCompletionTimeout]);

  const schedulePromptCompletionFallback = useCallback(
    (durationSeconds?: number) => {
      clearPromptCompletionTimeout();

      const fallbackDurationMs =
        durationSeconds && Number.isFinite(durationSeconds)
          ? Math.max(750, Math.ceil(durationSeconds * 1000) + 250)
          : 2500;

      promptCompletionTimeoutRef.current = window.setTimeout(() => {
        markPromptReady();
      }, fallbackDurationMs);
    },
    [clearPromptCompletionTimeout, markPromptReady]
  );

  const stopActiveAudio = useCallback(() => {
    clearPromptCompletionTimeout();
    clearAutoAdvanceTimeout();
    clearPrepCountdown();

    if (currentBufferSourceRef.current) {
      try {
        currentBufferSourceRef.current.stop();
      } catch {
        // Ignore stop errors for already-ended buffer sources.
      }

      try {
        currentBufferSourceRef.current.disconnect();
      } catch {
        // Ignore disconnect errors for stale sources.
      }

      currentBufferSourceRef.current = null;
    }

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
    }
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }
  }, [clearAutoAdvanceTimeout, clearPrepCountdown, clearPromptCompletionTimeout]);

  const playSynthesizedPrompt = useCallback(
    async (blob: Blob) => {
      const audioContext = audioContextRef.current;

      if (audioContext) {
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        const arrayBuffer = await blob.arrayBuffer();
        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        const source = audioContext.createBufferSource();

        source.buffer = decodedBuffer;
        source.connect(audioContext.destination);
        currentBufferSourceRef.current = source;
        schedulePromptCompletionFallback(decodedBuffer.duration);

        source.onended = () => {
          if (currentBufferSourceRef.current === source) {
            currentBufferSourceRef.current = null;
          }
          markPromptReady();
        };

        setPlaybackState('playing');
        source.start(0);
        return;
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      currentAudioUrlRef.current = url;
      currentAudioRef.current = audio;

      audio.addEventListener(
        'loadedmetadata',
        () => {
          if (Number.isFinite(audio.duration)) {
            schedulePromptCompletionFallback(audio.duration);
          }
        },
        { once: true }
      );

      audio.addEventListener(
        'ended',
        () => {
          markPromptReady();
        },
        { once: true }
      );

      try {
        setPlaybackState('playing');
        await audio.play();
        if (audio.readyState >= HTMLMediaElement.HAVE_METADATA && Number.isFinite(audio.duration)) {
          schedulePromptCompletionFallback(audio.duration);
        } else {
          schedulePromptCompletionFallback();
        }
      } catch {
        markPromptReady();
      }
    },
    [audioContextRef, markPromptReady, schedulePromptCompletionFallback]
  );

  const stopRecorder = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    streamRef.current = null;
  }, []);

  const hydrateRuntime = useCallback(
    async (next: LiveSimulationSession) => {
      onSessionChange(next);
      setTurnState('idle');
      setLocalPause(null);
    },
    [onSessionChange]
  );

  const submitTranscript = useCallback(
    async (transcript: string, durationSeconds?: number) => {
      if (!session) return;

      setTurnState('submitting');
      pendingTranscriptRef.current = transcript;
      setLastTranscript(transcript);

      try {
        const response = await submitSimulationRuntimeAnswer(session.simulationId, {
          transcript,
          durationSeconds
        });
        await hydrateRuntime(mergeRuntimeIntoSimulation(session, response));
      } catch (error: any) {
        const message = error instanceof ApiError ? error.message : error?.message || 'Failed to submit this speaking turn.';
        setTurnState('idle');
        setLocalPause({
          step: 'submission',
          message
        });
      }
    },
    [hydrateRuntime, session]
  );

  const transcribeAndSubmitAudio = useCallback(
    async (audioBlob: Blob, durationSeconds: number) => {
      setTurnState('transcribing');
      pendingAudioBlobRef.current = audioBlob;
      pendingDurationRef.current = durationSeconds;

      try {
        const transcription = await transcribeSimulationAudio(audioBlob);
        const transcript = transcription.text?.trim();
        if (!transcript) {
          throw new Error('The recording finished, but no transcript was returned.');
        }

        await submitTranscript(transcript, durationSeconds || transcription.duration);
      } catch (error: any) {
        const message =
          error instanceof ApiError ? error.message : error?.message || 'Transcription failed for the current speaking turn.';
        setTurnState('idle');
        setLocalPause({
          step: 'transcription',
          message
        });
      }
    },
    [submitTranscript]
  );

  const startRecording = useCallback(async () => {
    if (!session || !isCandidateRuntimeState(session.runtime.state)) return;

    setLocalPause(null);
    setLastTranscript('');

    try {
      const constraints = deviceId ? { audio: { deviceId: { exact: deviceId } } } : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const recorder = new MediaRecorder(stream);

      chunksRef.current = [];
      turnStartedAtRef.current = Date.now();
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = event => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const elapsedSeconds = Math.max(
          1,
          Math.round(((Date.now() - (turnStartedAtRef.current || Date.now())) / 1000) || 1)
        );
        turnStartedAtRef.current = null;

        const mimeType = recorder.mimeType || chunksRef.current[0]?.type || 'audio/webm';
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        stopRecorder();
        void transcribeAndSubmitAudio(audioBlob, elapsedSeconds);
      };

      recorder.start();
      setTurnState('recording');
    } catch (error) {
      stopRecorder();
      setTurnState('idle');
      setLocalPause({
        step: 'submission',
        message: getMicErrorMessage(error)
      });
    }
  }, [deviceId, session, stopRecorder, transcribeAndSubmitAudio]);

  const stopRecordingTurn = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const continueAfterPrompt = useCallback(async () => {
    if (!session) return;

    try {
      if (runtime?.state === 'evaluation') {
        setTurnState('scoring');
        const result = await completeSimulationRuntime(session);
        await onComplete(result);
        return;
      }

      const response = await advanceSimulationRuntime(session.simulationId);
      await hydrateRuntime(mergeRuntimeIntoSimulation(session, response));
    } catch (error: any) {
      const message =
        error instanceof ApiError ? error.message : error?.message || 'Failed to move the simulation to the next step.';
      setTurnState('idle');
      lastAutoAdvanceKeyRef.current = '';
      setLocalPause({
        step: 'advance',
        message
      });
    }
  }, [hydrateRuntime, onComplete, runtime?.state, session]);

  const retryCurrentStep = useCallback(async () => {
    if (!session) return;

    if (isBackendPause) {
      const response = await retrySimulationRuntimeStep(session.simulationId);
      await hydrateRuntime(mergeRuntimeIntoSimulation(session, response));
      return;
    }

    if (!localPause) return;

    setLocalPause(null);

    if (localPause.step === 'synthesis') {
      lastSegmentKeyRef.current = '';
      setPlaybackState('idle');
      setPromptReady(false);
      return;
    }

    if (localPause.step === 'transcription' && pendingAudioBlobRef.current) {
      await transcribeAndSubmitAudio(pendingAudioBlobRef.current, pendingDurationRef.current);
      return;
    }

    if (localPause.step === 'submission' && pendingTranscriptRef.current) {
      await submitTranscript(pendingTranscriptRef.current, pendingDurationRef.current);
      return;
    }

    if (localPause.step === 'advance') {
      lastAutoAdvanceKeyRef.current = '';
      await continueAfterPrompt();
    }
  }, [continueAfterPrompt, hydrateRuntime, isBackendPause, localPause, session, submitTranscript, transcribeAndSubmitAudio]);

  const replayPrompt = useCallback(() => {
    lastSegmentKeyRef.current = '';
    lastAutoAdvanceKeyRef.current = '';
    setPromptReady(false);
    setPlaybackState('idle');
  }, []);

  useEffect(() => {
    if (!session || !runtime || !segment) return;
    if (!isExaminerTurn) {
      setPromptReady(false);
      setPlaybackState('idle');
      clearAutoAdvanceTimeout();
      stopActiveAudio();
      return;
    }
    if (localPause) return;

    const segmentKey = buildSegmentKey(session);
    if (lastSegmentKeyRef.current === segmentKey) return;
    lastSegmentKeyRef.current = segmentKey;

    const promptText = segment.text?.trim();
    if (!promptText) {
      setPlaybackState('ready');
      setPromptReady(true);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setPlaybackState('synthesizing');
      setPromptReady(false);
      stopActiveAudio();

      try {
        const synthesis = await synthesizeSimulationSegment(promptText, segment.phraseId || segmentKey);
        if (cancelled) return;

        const blob = decodeAudioBase64(synthesis.audioBase64, synthesis.mimeType || 'audio/mpeg');
        await playSynthesizedPrompt(blob);
      } catch (error: any) {
        if (cancelled) return;
        const message =
          error instanceof ApiError ? error.message : error?.message || 'Examiner audio failed for the current prompt.';
        setPlaybackState('idle');
        setPromptReady(false);
        setLocalPause({
          step: 'synthesis',
          message
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [clearAutoAdvanceTimeout, isExaminerTurn, localPause, playSynthesizedPrompt, runtime, segment, session, stopActiveAudio]);

  useEffect(() => {
    if (!session || !runtime || !segment || !promptReady || !shouldAutoAdvanceAfterPrompt || localPause) {
      clearAutoAdvanceTimeout();
      clearPrepCountdown();
      return;
    }

    const segmentKey = buildSegmentKey(session);
    if (lastAutoAdvanceKeyRef.current === segmentKey) {
      return;
    }
    lastAutoAdvanceKeyRef.current = segmentKey;

    if (runtime.state === 'part2-prep') {
      const prepDurationMs = 60_000;
      const prepEndsAt = Date.now() + prepDurationMs;
      setPart2PrepRemaining(60);

      prepCountdownIntervalRef.current = window.setInterval(() => {
        const remaining = Math.max(0, Math.ceil((prepEndsAt - Date.now()) / 1000));
        setPart2PrepRemaining(remaining);
      }, 250);

      autoAdvanceTimeoutRef.current = window.setTimeout(() => {
        clearPrepCountdown();
        void continueAfterPrompt();
      }, prepDurationMs);
    } else {
      clearPrepCountdown();
      autoAdvanceTimeoutRef.current = window.setTimeout(() => {
        void continueAfterPrompt();
      }, 200);
    }

    return () => {
      clearAutoAdvanceTimeout();
      clearPrepCountdown();
    };
  }, [
    clearAutoAdvanceTimeout,
    clearPrepCountdown,
    continueAfterPrompt,
    localPause,
    promptReady,
    runtime,
    segment,
    session,
    shouldAutoAdvanceAfterPrompt
  ]);

  useEffect(() => {
    return () => {
      stopActiveAudio();
      stopRecorder();
    };
  }, [stopActiveAudio, stopRecorder]);

  const partProgress = useMemo(() => {
    const activePart = runtime?.currentPart || 0;
    return [1, 2, 3].map(part => {
      const isActive = activePart === part;
      const isComplete = activePart > part || runtime?.state === 'evaluation';
      return {
        part,
        label: `Part ${part}`,
        tone: isActive ? 'violet' : isComplete ? 'emerald' : 'gray'
      };
    });
  }, [runtime?.currentPart, runtime?.state]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Full Speaking Simulation</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Complete the full examiner-led IELTS speaking test with timed prompts, live recording, and one final evaluation.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => void onStart()}
            disabled={starting}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-wait ${
              starting
                ? 'bg-violet-300 text-white shadow-none hover:bg-violet-300'
                : 'bg-violet-600 text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">play_arrow</span>
            {starting ? 'Preparing simulation...' : 'Start Full Simulation'}
          </button>
          {elapsed > 0 ? (
            <span className="rounded-full bg-violet-100 dark:bg-violet-500/20 px-3 py-1 text-xs font-bold text-violet-700 dark:text-violet-300">
              {elapsed}s elapsed
            </span>
          ) : null}
        </div>
      </section>

      {starting && !session ? (
        <section
          ref={workspaceRef}
          tabIndex={-1}
          className="rounded-2xl border-2 border-violet-200 dark:border-violet-500/30 bg-violet-50/50 dark:bg-violet-500/5 p-6 space-y-4 scroll-mt-28 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[22px] text-violet-600 animate-pulse">hourglass_top</span>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Preparing your full simulation</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                We are building all three speaking parts and saving your timer state.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {session ? (
        <section
          ref={workspaceRef}
          tabIndex={-1}
          className="rounded-2xl border-2 border-violet-200 dark:border-violet-500/30 bg-violet-50/50 dark:bg-violet-500/5 p-6 space-y-5 scroll-mt-28 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Simulation in Progress</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Follow the examiner. Recording only unlocks when it is your turn to answer.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge tone={isExaminerTurn ? 'info' : isCandidateTurn ? 'warning' : isBackendPause || localPause ? 'danger' : 'neutral'}>
                {isExaminerTurn ? 'Examiner turn' : isCandidateTurn ? 'Candidate turn' : isBackendPause || localPause ? 'Paused' : runtime?.state || 'Idle'}
              </StatusBadge>
              <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-600 dark:text-gray-400">
                {currentPartChip}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {partProgress.map(part => (
              <span
                key={part.part}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                  part.tone === 'violet'
                    ? 'bg-violet-600 text-white'
                    : part.tone === 'emerald'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                      : 'border border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400'
                }`}
              >
                {part.label}
              </span>
            ))}
          </div>

          {isBackendPause || localPause ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-4 dark:border-amber-500/20 dark:bg-amber-500/10">
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                  {isBackendTerminal ? 'Simulation needs restart' : 'Simulation paused'}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">{effectivePauseMessage}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {!isBackendTerminal ? (
                  <button
                    onClick={() => void retryCurrentStep()}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
                  >
                    Retry step
                  </button>
                ) : null}
                <button
                  onClick={() => void onRestart()}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Restart simulation
                </button>
              </div>
            </div>
          ) : null}

          {!isBackendPause && !localPause && isExaminerTurn ? (
            <div className="rounded-2xl border border-violet-100 bg-white/90 p-5 space-y-4 dark:border-violet-500/20 dark:bg-gray-900/70">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="info">Examiner speaking</StatusBadge>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  {resolvePartLabel(runtime?.currentPart || 0)}
                </span>
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                  {runtime?.state === 'evaluation' ? 'Closing the test and preparing your score' : 'Examiner speaking'}
                </h4>
                <p className="text-base leading-7 text-gray-800 dark:text-gray-200">{segment?.text}</p>
              </div>
              {currentPart?.topicTitle ? (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950/50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Topic</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{currentPart.topicTitle}</p>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  disabled
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-300 px-5 py-2 text-sm font-semibold text-white cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[18px]">mic</span>
                  Start Recording
                </button>
                {!shouldAutoAdvanceAfterPrompt ? (
                  <button
                    onClick={() => void continueAfterPrompt()}
                    disabled={!promptReady || turnState === 'scoring'}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:cursor-not-allowed disabled:bg-violet-300"
                  >
                    {runtime?.state === 'evaluation' ? 'Score full simulation' : 'Continue after prompt'}
                  </button>
                ) : null}
                <button
                  onClick={replayPrompt}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Replay prompt
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {playbackState === 'synthesizing'
                    ? 'Preparing examiner audio...'
                    : playbackState === 'playing'
                      ? 'Examiner audio is playing.'
                      : runtime?.state === 'part2-prep' && promptReady
                        ? `Prep time remaining: ${part2PrepRemaining ?? 60}s`
                      : runtime?.state === 'evaluation' && promptReady
                        ? 'Preparing your score...'
                      : promptReady && shouldAutoAdvanceAfterPrompt
                        ? 'Switching to your turn...'
                      : promptReady
                        ? 'Prompt finished. Continue when ready.'
                        : 'Loading examiner prompt.'}
                </span>
              </div>
            </div>
          ) : null}

          {!isBackendPause && !localPause && isCandidateTurn ? (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/90 p-5 space-y-4 dark:bg-gray-900/70">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="warning">Your turn</StatusBadge>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  {resolvePartLabel(runtime?.currentPart || 0)}
                </span>
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">Your turn</h4>
                <p className="text-base leading-7 text-gray-800 dark:text-gray-200">
                  {runtime?.currentPart === 0
                    ? 'Respond to the examiner and confirm your identity details.'
                    : segment?.text || currentPart?.question || 'Answer the examiner clearly and at a natural pace.'}
                </p>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Microphone</span>
                <select
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  value={deviceId}
                  onChange={event => onDeviceChange(event.target.value)}
                >
                  {devices.length ? (
                    devices.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || 'Microphone'}
                      </option>
                    ))
                  ) : (
                    <option value="">Default microphone</option>
                  )}
                </select>
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => void startRecording()}
                  disabled={!canStartRecording}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:cursor-not-allowed disabled:bg-violet-300"
                >
                  <span className="material-symbols-outlined text-[18px]">mic</span>
                  Start Recording
                </button>
                <button
                  onClick={stopRecordingTurn}
                  disabled={!canStopRecording}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">stop</span>
                  Stop + Submit
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {turnState === 'recording'
                    ? 'Recording in progress.'
                    : turnState === 'transcribing'
                      ? 'Transcribing your response...'
                      : turnState === 'submitting'
                        ? 'Sending your answer to the examiner...'
                        : turnState === 'scoring'
                          ? 'Scoring the full simulation...'
                          : 'Recording unlocks only during your turn.'}
                </span>
              </div>

              {lastTranscript ? (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950/50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Latest transcript captured</p>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{lastTranscript}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
