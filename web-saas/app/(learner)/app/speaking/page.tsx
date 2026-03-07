'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import AuthenticSimulationStage from '@/components/speaking/AuthenticSimulationStage';
import ActiveAttemptLeaveGuard from '@/components/session/ActiveAttemptLeaveGuard';
import { ApiError, apiRequest, handleUsageLimitRedirect } from '@/lib/api/client';
import { LiveSimulationSession, getSimulationRuntime, mergeRuntimeIntoSimulation, startSimulationRuntime } from '@/lib/speaking/simulationRuntime';
import { PageHeader, SectionCard, StatusBadge, SegmentedTabs, EmptyState } from '@/components/ui/v2';
import {
  PracticeAudioUploadResult,
  PracticeSession,
  PracticeSessionStartPayload,
  PracticeTopic,
  PracticeTopicPage,
  SimulationSession,
  SpeakingEvaluation
} from '@/lib/types';

type SynthesizeResponse = {
  audioBase64: string;
  mimeType: string;
};

type RecorderState = 'idle' | 'recording' | 'uploading' | 'error';
const speakingResumeStorageKey = 'spokio.web.speaking.resume';

type SpeakingResumeSnapshot = {
  activeTab: 'practice' | 'simulation' | 'quick';
  practiceSession: PracticeSessionStartPayload | null;
  practiceManualResponse: string;
  practiceTranscription: string;
  practiceElapsed: number;
  simulation: LiveSimulationSession | null;
  simulationElapsed: number;
  savedAt: string;
};

type BrowserAudioContextConstructor = typeof AudioContext;

const quickQuestionBank = [
  'Describe a skill you learned recently and why it was important.',
  'Talk about a challenge you solved and what you learned from it.',
  'Describe a place in your city that visitors should see and explain why.'
];

const buildLibraryHref = (
  kind: 'collocations' | 'vocabulary',
  module: 'speaking' | 'writing' | 'reading' | 'listening',
  seed?: string
) => {
  const query = new URLSearchParams();
  query.set('module', module);
  if (seed) query.set('search', seed);
  return `/app/library/${kind}${query.toString() ? `?${query.toString()}` : ''}`;
};

const decodeAudioBase64 = (base64: string, mimeType: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
};

const getMicErrorMessage = (error: any) => {
  const name = String(error?.name || '');

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Microphone permission denied. You can continue with manual transcript input.';
  }
  if (name === 'NotFoundError') {
    return 'No microphone device found. Connect a microphone or use manual transcript input.';
  }
  if (name === 'NotReadableError') {
    return 'Your microphone is currently in use by another app.';
  }
  if (name === 'OverconstrainedError') {
    return 'Selected microphone is unavailable. Switch device and try again.';
  }

  return error?.message || 'Unable to access microphone.';
};

const getSimulationMicSetupErrorMessage = (error: any) => {
  const name = String(error?.name || '');

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Microphone permission is required before the full simulation can begin. Allow microphone access and start a new simulation.';
  }
  if (name === 'NotFoundError') {
    return 'No microphone device was found. Connect a microphone before starting the full simulation.';
  }
  if (name === 'NotReadableError') {
    return 'Your microphone is already in use by another app. Close the other app, then start a new simulation.';
  }
  if (name === 'OverconstrainedError') {
    return 'The selected microphone is unavailable. Choose another microphone, then start a new simulation.';
  }

  return error?.message || 'Microphone access failed before the full simulation could begin.';
};

const getBrowserAudioContextConstructor = (): BrowserAudioContextConstructor | null => {
  if (typeof window === 'undefined') return null;

  const browserWindow = window as Window &
    typeof globalThis & {
      webkitAudioContext?: BrowserAudioContextConstructor;
    };

  return browserWindow.AudioContext || browserWindow.webkitAudioContext || null;
};

export default function SpeakingPage() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const simulationAudioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const practiceWorkspaceRef = useRef<HTMLElement | null>(null);
  const practiceInlineSurfaceRef = useRef<HTMLElement | null>(null);
  const simulationWorkspaceRef = useRef<HTMLElement | null>(null);
  const quickEvaluationRef = useRef<HTMLElement | null>(null);
  const practiceTimerRef = useRef<number | null>(null);
  const simulationTimerRef = useRef<number | null>(null);

  const [activeTab, setActiveTab] = useState<'practice' | 'simulation' | 'quick'>('practice');
  const [errorMessage, setErrorMessage] = useState('');
  const [resumeNotice, setResumeNotice] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [recorderState, setRecorderState] = useState<RecorderState>('idle');

  const [topicCategory, setTopicCategory] = useState<'all' | 'part1' | 'part2' | 'part3'>('all');
  const [topics, setTopics] = useState<PracticeTopic[]>([]);
  const [topicSearch, setTopicSearch] = useState('');
  const [topicsOffset, setTopicsOffset] = useState(0);
  const [hasMoreTopics, setHasMoreTopics] = useState(true);
  const [topicLoading, setTopicLoading] = useState(false);

  const [practiceSession, setPracticeSession] = useState<PracticeSessionStartPayload | null>(null);
  const [practiceResult, setPracticeResult] = useState<PracticeSession | null>(null);
  const [practiceTranscription, setPracticeTranscription] = useState('');
  const [practiceManualResponse, setPracticeManualResponse] = useState('');
  const [practiceHistory, setPracticeHistory] = useState<PracticeSession[]>([]);
  const [practiceElapsed, setPracticeElapsed] = useState(0);

  const [simulation, setSimulation] = useState<LiveSimulationSession | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationSession | null>(null);
  const [simulationHistory, setSimulationHistory] = useState<SimulationSession[]>([]);
  const [simulationElapsed, setSimulationElapsed] = useState(0);
  const [simulationStarting, setSimulationStarting] = useState(false);

  const [quickQuestion, setQuickQuestion] = useState(quickQuestionBank[0]);
  const [quickTranscript, setQuickTranscript] = useState('');
  const [quickEvaluation, setQuickEvaluation] = useState<SpeakingEvaluation | null>(null);
  const [ttsAudioUrl, setTtsAudioUrl] = useState('');

  const supportsMedia = useMemo(
    () => typeof window !== 'undefined' && !!navigator.mediaDevices && typeof window.MediaRecorder !== 'undefined',
    []
  );

  const refreshDevices = async () => {
    if (!supportsMedia) return;

    const list = await navigator.mediaDevices.enumerateDevices();
    const mics = list.filter(device => device.kind === 'audioinput');
    setDevices(mics);
    if (!deviceId && mics[0]) {
      setDeviceId(mics[0].deviceId);
    }
  };

  const ensureSimulationAudioContext = useCallback(async () => {
    const AudioContextCtor = getBrowserAudioContextConstructor();
    if (!AudioContextCtor) return null;

    if (!simulationAudioContextRef.current) {
      simulationAudioContextRef.current = new AudioContextCtor();
    }

    if (simulationAudioContextRef.current.state === 'suspended') {
      await simulationAudioContextRef.current.resume();
    }

    return simulationAudioContextRef.current;
  }, []);

  const primeSimulationMicrophone = useCallback(async () => {
    if (!supportsMedia) {
      throw new Error('This browser does not support microphone recording for the live simulation.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { deviceId: { exact: deviceId } } : true
    });

    stream.getTracks().forEach(track => track.stop());
    await refreshDevices();
  }, [deviceId, supportsMedia]);

  const stopRecorder = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    streamRef.current = null;
  };

  const startPracticeTimer = (initialElapsed = 0) => {
    if (practiceTimerRef.current) {
      window.clearInterval(practiceTimerRef.current);
    }

    setPracticeElapsed(initialElapsed);
    practiceTimerRef.current = window.setInterval(() => {
      setPracticeElapsed(prev => prev + 1);
    }, 1000);
  };

  const stopPracticeTimer = () => {
    if (practiceTimerRef.current) {
      window.clearInterval(practiceTimerRef.current);
      practiceTimerRef.current = null;
    }
  };

  const startSimulationTimer = (initialElapsed = 0) => {
    if (simulationTimerRef.current) {
      window.clearInterval(simulationTimerRef.current);
    }

    setSimulationElapsed(initialElapsed);
    simulationTimerRef.current = window.setInterval(() => {
      setSimulationElapsed(prev => prev + 1);
    }, 1000);
  };

  const stopSimulationTimer = () => {
    if (simulationTimerRef.current) {
      window.clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }
  };

  const scrollToSurface = useCallback((element: HTMLElement | null) => {
    if (!element) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const top = Math.max(0, element.getBoundingClientRect().top + window.scrollY - 112);

    window.scrollTo({
      top,
      behavior: prefersReducedMotion ? 'auto' : 'smooth'
    });
    element.focus({ preventScroll: true });
  }, []);

  const hasActiveSpeakingAttempt = Boolean(
    (practiceSession && !practiceResult) || (simulation && !simulationResult)
  );

  const saveSpeakingSnapshot = useCallback(() => {
    const snapshot: SpeakingResumeSnapshot = {
      activeTab,
      practiceSession,
      practiceManualResponse,
      practiceTranscription,
      practiceElapsed,
      simulation,
      simulationElapsed,
      savedAt: new Date().toISOString()
    };
    window.localStorage.setItem(speakingResumeStorageKey, JSON.stringify(snapshot));
    return snapshot;
  }, [
    activeTab,
    practiceElapsed,
    practiceManualResponse,
    practiceSession,
    practiceTranscription,
    simulation,
    simulationElapsed
  ]);

  const saveSpeakingSnapshotForLeave = useCallback(async () => {
    if (!hasActiveSpeakingAttempt) return;
    saveSpeakingSnapshot();
    stopPracticeTimer();
    stopSimulationTimer();
  }, [hasActiveSpeakingAttempt, saveSpeakingSnapshot]);

  const loadTopics = async (reset = false) => {
    setTopicLoading(true);
    setErrorMessage('');

    const nextOffset = reset ? 0 : topicsOffset;
    try {
      const categoryParam = topicCategory === 'all' ? '' : `&category=${topicCategory}`;
      const page = await apiRequest<PracticeTopicPage>(
        `/topics/practice?limit=12&offset=${nextOffset}&excludeCompleted=true${categoryParam}`
      );

      setTopics(prev => (reset ? page.topics : [...prev, ...page.topics]));
      setTopicsOffset(nextOffset + page.topics.length);
      setHasMoreTopics(page.hasMore);
    } catch (error: any) {
      if (handleUsageLimitRedirect(error)) return;
      setErrorMessage(error?.message || 'Failed to load speaking topics.');
    } finally {
      setTopicLoading(false);
    }
  };

  const refreshPracticeHistory = async () => {
    try {
      const items = await apiRequest<PracticeSession[]>('/practice/sessions?limit=8&offset=0');
      setPracticeHistory(items);
    } catch {
      // Keep page functional even if history fails.
    }
  };

  const refreshSimulationHistory = async () => {
    try {
      const items = await apiRequest<SimulationSession[]>('/test-simulations?limit=8&offset=0');
      setSimulationHistory(items);
    } catch {
      // Keep page functional even if history fails.
    }
  };

  const startPracticeSession = async (topic: PracticeTopic) => {
    setErrorMessage('');
    setResumeNotice('');
    setPracticeResult(null);
    setPracticeTranscription('');
    setPracticeManualResponse('');
    setRecorderState('idle');

    try {
      const session = await apiRequest<PracticeSessionStartPayload>('/practice/sessions', {
        method: 'POST',
        body: JSON.stringify({ topicId: topic.slug })
      });
      setPracticeSession(session);
      startPracticeTimer();
    } catch (error: any) {
      if (handleUsageLimitRedirect(error)) return;
      setErrorMessage(error?.message || 'Failed to start speaking practice session.');
    }
  };

  const completePracticeSessionWithText = async () => {
    if (!practiceSession) return;
    if (practiceManualResponse.trim().length < 6) {
      setErrorMessage('Please provide a fuller response before submitting.');
      return;
    }

    setErrorMessage('');
    setRecorderState('uploading');
    try {
      const result = await apiRequest<PracticeSession>(`/practice/sessions/${practiceSession.sessionId}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          userResponse: practiceManualResponse.trim(),
          timeSpent: practiceElapsed
        })
      });

      setPracticeResult(result);
      stopPracticeTimer();
      window.localStorage.removeItem(speakingResumeStorageKey);
      await refreshPracticeHistory();
      setRecorderState('idle');
    } catch (error: any) {
      if (handleUsageLimitRedirect(error)) return;
      setRecorderState('error');
      setErrorMessage(error?.message || 'Failed to complete speaking practice session.');
    }
  };

  const uploadPracticeAudio = async () => {
    if (!practiceSession) return;

    const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'practice.webm');

    try {
      const payload = await apiRequest<PracticeAudioUploadResult>(`/practice/sessions/${practiceSession.sessionId}/audio`, {
        method: 'POST',
        body: formData
      });
      const transcribedText = payload.transcription?.text?.trim() || '';

      setPracticeResult(payload.session);
      setPracticeTranscription(transcribedText);
      setPracticeManualResponse(current => (current.trim() ? current : transcribedText));
      stopPracticeTimer();
      window.localStorage.removeItem(speakingResumeStorageKey);
      setRecorderState('idle');
      await refreshPracticeHistory();
    } catch (error: any) {
      if (handleUsageLimitRedirect(error)) return;
      setRecorderState('error');
      setErrorMessage(error?.message || 'Audio upload failed. You can still use manual transcript input.');
    } finally {
      stopRecorder();
    }
  };

  const startRecording = async () => {
    if (!practiceSession) {
      setErrorMessage('Start a speaking session before recording.');
      return;
    }

    setErrorMessage('');
    setRecorderState('idle');

    if (!supportsMedia) {
      setRecorderState('error');
      setErrorMessage('Browser recording is not supported. Please use manual transcript input.');
      return;
    }

    try {
      await refreshDevices();
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true
      });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = event => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        setRecorderState('uploading');
        void uploadPracticeAudio();
      };

      recorder.start(250);
      setRecorderState('recording');
    } catch (error: any) {
      setRecorderState('error');
      setErrorMessage(getMicErrorMessage(error));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const startSimulation = async () => {
    if (simulationStarting) return;

    setActiveTab('simulation');
    setErrorMessage('');
    setResumeNotice('');
    stopSimulationTimer();
    setSimulation(null);
    setSimulationResult(null);
    setSimulationElapsed(0);
    setSimulationStarting(true);

    try {
      await ensureSimulationAudioContext();
      await primeSimulationMicrophone();

      const started = await startSimulationRuntime();
      const hydrated =
        started.runtime
          ? started
          : mergeRuntimeIntoSimulation(started, await getSimulationRuntime(started.simulationId));

      setSimulation(hydrated);
      startSimulationTimer();
    } catch (error: any) {
      if (handleUsageLimitRedirect(error)) return;
      const message =
        error instanceof ApiError ? error.message : getSimulationMicSetupErrorMessage(error);
      setErrorMessage(message || 'Failed to start speaking simulation.');
    } finally {
      setSimulationStarting(false);
    }
  };

  const loadSimulationDetail = async (simulationId: string) => {
    setErrorMessage('');
    try {
      const detail = await apiRequest<SimulationSession>(`/test-simulations/${simulationId}`);
      setSimulationResult(detail);
    } catch (error: any) {
      if (handleUsageLimitRedirect(error)) return;
      setErrorMessage(error?.message || 'Unable to load simulation details.');
    }
  };

  const handleSimulationSessionChange = useCallback((next: LiveSimulationSession | null) => {
    setSimulation(next);
  }, []);

  useEffect(() => {
    if (!simulation || simulation.runtime) return;

    let cancelled = false;

    const hydrateMissingRuntime = async () => {
      try {
        const response = await getSimulationRuntime(simulation.simulationId);
        if (cancelled) return;
        setSimulation(current => {
          if (!current || current.simulationId !== simulation.simulationId || current.runtime) {
            return current;
          }
          return mergeRuntimeIntoSimulation(current, response);
        });
      } catch (error: any) {
        if (cancelled) return;
        setErrorMessage(current => current || error?.message || 'Failed to restore the speaking simulation runtime.');
      }
    };

    void hydrateMissingRuntime();

    return () => {
      cancelled = true;
    };
  }, [simulation]);

  const handleSimulationComplete = useCallback(
    async (result: SimulationSession) => {
      stopSimulationTimer();
      setSimulation(null);
      setSimulationResult(result);
      window.localStorage.removeItem(speakingResumeStorageKey);
      await refreshSimulationHistory();
    },
    []
  );

  const runQuickEvaluation = async () => {
    setErrorMessage('');
    setQuickEvaluation(null);

    if (quickTranscript.trim().length < 8) {
      setErrorMessage('Provide a transcript with at least a few full sentences.');
      return;
    }

    try {
      const evaluation = await apiRequest<SpeakingEvaluation>('/speech/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          transcript: quickTranscript.trim(),
          question: quickQuestion,
          testPart: 2
        })
      });
      setQuickEvaluation(evaluation);
    } catch (error: any) {
      if (handleUsageLimitRedirect(error)) return;
      setErrorMessage(error?.message || 'Quick speech evaluation failed.');
    }
  };

  const playPromptAudio = async () => {
    try {
      const tts = await apiRequest<SynthesizeResponse>('/speech/synthesize', {
        method: 'POST',
        body: JSON.stringify({ text: quickQuestion })
      });
      const blob = decodeAudioBase64(tts.audioBase64, tts.mimeType || 'audio/mpeg');
      const url = URL.createObjectURL(blob);
      setTtsAudioUrl(url);

      const audio = new Audio(url);
      await audio.play();
    } catch (error: any) {
      if (handleUsageLimitRedirect(error)) return;
      setErrorMessage(error?.message || 'Prompt TTS failed');
    }
  };

  // Initial bootstrap and category-driven topic refresh.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    void loadTopics(true);
    void refreshPracticeHistory();
    void refreshSimulationHistory();
    void refreshDevices();
  }, []);

  useEffect(() => {
    void loadTopics(true);
  }, [topicCategory]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    const raw = window.localStorage.getItem(speakingResumeStorageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as SpeakingResumeSnapshot;
      if (!parsed || (!parsed.practiceSession && !parsed.simulation)) return;

      setActiveTab(parsed.activeTab || 'practice');
      setPracticeSession(parsed.practiceSession || null);
      setPracticeManualResponse(parsed.practiceManualResponse || '');
      setPracticeTranscription(parsed.practiceTranscription || '');
      setPracticeElapsed(parsed.practiceElapsed || 0);
      setPracticeResult(null);

      setSimulation(parsed.simulation || null);
      setSimulationElapsed(parsed.simulationElapsed || 0);
      setSimulationResult(null);

      if (parsed.practiceSession) {
        startPracticeTimer(Math.max(0, parsed.practiceElapsed || 0));
      }
      if (parsed.simulation) {
        startSimulationTimer(Math.max(0, parsed.simulationElapsed || 0));
      }

      setResumeNotice('Recovered your saved speaking attempt. Continue from where you left off.');
    } catch {
      window.localStorage.removeItem(speakingResumeStorageKey);
    }
  }, []);

  useEffect(() => {
    if (!hasActiveSpeakingAttempt) return;
    saveSpeakingSnapshot();
  }, [hasActiveSpeakingAttempt, saveSpeakingSnapshot]);

  useEffect(() => {
    if (activeTab !== 'practice' || !practiceSession) return;

    const frame = window.requestAnimationFrame(() => {
      scrollToSurface(practiceWorkspaceRef.current);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, practiceSession, scrollToSurface]);

  useEffect(() => {
    if (activeTab !== 'simulation' || (!simulation && !simulationStarting && !simulationResult)) return;

    const frame = window.requestAnimationFrame(() => {
      scrollToSurface(simulationWorkspaceRef.current);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, simulation, simulationResult, simulationStarting, scrollToSurface]);

  useEffect(() => {
    if (activeTab !== 'quick' || !quickEvaluation) return;

    const frame = window.requestAnimationFrame(() => {
      scrollToSurface(quickEvaluationRef.current);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, quickEvaluation, scrollToSurface]);

  useEffect(() => {
    if (hasActiveSpeakingAttempt) return;
    window.localStorage.removeItem(speakingResumeStorageKey);
  }, [hasActiveSpeakingAttempt]);

  useEffect(() => {
    return () => {
      stopPracticeTimer();
      stopSimulationTimer();
      stopRecorder();
      void simulationAudioContextRef.current?.close?.();
    };
  }, []);

  const filteredTopics = useMemo(() => {
    if (!topicSearch.trim()) return topics;
    const q = topicSearch.toLowerCase();
    return topics.filter(t => t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
  }, [topics, topicSearch]);

  const canSubmitManualTranscript =
    recorderState !== 'uploading' && practiceManualResponse.trim().length >= 6;

  const practiceFeedback = practiceResult?.feedback;
  const practiceReviewTranscript = useMemo(
    () => practiceTranscription.trim() || practiceManualResponse.trim(),
    [practiceManualResponse, practiceTranscription]
  );
  const showPracticeInlineProcessing = Boolean(practiceSession && recorderState === 'uploading');
  const showPracticeInlineError = Boolean(practiceSession && recorderState === 'error' && errorMessage);
  const showPracticeInlineReview = Boolean(practiceSession && practiceResult);
  const showGlobalErrorMessage = Boolean(errorMessage) && !showPracticeInlineError;

  const practiceStatusBadge = useMemo(() => {
    if (recorderState === 'recording') {
      return { tone: 'warning' as const, label: 'Recording' };
    }
    if (recorderState === 'uploading') {
      return { tone: 'info' as const, label: 'Processing' };
    }
    if (recorderState === 'error') {
      return { tone: 'danger' as const, label: 'Needs attention' };
    }
    if (practiceResult) {
      return { tone: 'success' as const, label: 'Feedback ready' };
    }
    return { tone: 'neutral' as const, label: 'Ready' };
  }, [practiceResult, recorderState]);

  const practiceDetailHref = useMemo(() => {
    const sessionId = practiceResult?.sessionId || practiceResult?._id || practiceSession?.sessionId;
    return sessionId ? `/app/speaking/history/${sessionId}` : '';
  }, [practiceResult?._id, practiceResult?.sessionId, practiceSession?.sessionId]);

  const practiceBandRows = useMemo(() => {
    const breakdown = practiceFeedback?.bandBreakdown;
    if (!breakdown) return [];

    return [
      { label: 'Fluency', value: breakdown.fluency },
      { label: 'Vocabulary', value: breakdown.lexicalResource },
      { label: 'Grammar', value: breakdown.grammaticalRange },
      { label: 'Pronunciation', value: breakdown.pronunciation }
    ].filter(row => typeof row.value === 'number');
  }, [practiceFeedback?.bandBreakdown]);

  useEffect(() => {
    if (activeTab !== 'practice' || !practiceSession) return;
    if (!showPracticeInlineProcessing && !showPracticeInlineError && !showPracticeInlineReview) return;

    const frame = window.requestAnimationFrame(() => {
      scrollToSurface(practiceInlineSurfaceRef.current || practiceWorkspaceRef.current);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    activeTab,
    practiceSession,
    scrollToSurface,
    showPracticeInlineError,
    showPracticeInlineProcessing,
    showPracticeInlineReview
  ]);

  const practiceWeaknessSeed = useMemo(() => {
    const feedback = practiceFeedback;
    if (!feedback) return '';
    if (feedback.improvements?.[0]) return feedback.improvements[0];

    const breakdown = feedback.bandBreakdown;
    if (!breakdown) return '';

    const scores = [
      { key: 'fluency', score: breakdown.fluency ?? 9, label: 'fluency and coherence' },
      { key: 'lexical', score: breakdown.lexicalResource ?? 9, label: 'lexical resource' },
      { key: 'grammar', score: breakdown.grammaticalRange ?? 9, label: 'grammatical range' },
      { key: 'pronunciation', score: breakdown.pronunciation ?? 9, label: 'pronunciation' }
    ];

    return scores.sort((a, b) => a.score - b.score)[0]?.label || '';
  }, [practiceFeedback]);

  const simulationWeaknessSeed = useMemo(() => {
    const feedback = simulationResult?.overallFeedback;
    if (!feedback) return '';
    return feedback.improvements?.[0] || feedback.summary || '';
  }, [simulationResult?.overallFeedback]);

  const simulationCtaLabel = simulationStarting ? 'Preparing simulation...' : 'Start Full Simulation';
  const simulationCtaClasses = simulationStarting
    ? 'bg-violet-300 text-white cursor-wait shadow-none hover:translate-y-0 hover:bg-violet-300 hover:shadow-none'
    : 'bg-violet-600 text-white shadow-md shadow-violet-500/25 hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-lg';

  return (
    <div className="space-y-8 max-w-[1440px] mx-auto w-full">
      {/* ── Page header ── */}
      <PageHeader
        kicker="Speaking Module"
        title="Speaking Practice"
        subtitle="Browse topics, run full simulations, or evaluate your transcript with AI."
        actions={
          <button
            onClick={() => void startSimulation()}
            disabled={simulationStarting}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:cursor-wait ${simulationCtaClasses}`}
          >
            <span className="material-symbols-outlined text-[18px]">play_arrow</span>
            {simulationCtaLabel}
          </button>
        }
      />

      {/* ── Tab pills ── */}
      <div className="flex justify-center sm:justify-start">
        <SegmentedTabs
          options={[
            { value: 'practice', label: 'Practice Topics' },
            { value: 'simulation', label: 'Simulation' },
            { value: 'quick', label: 'Quick Evaluate' }
          ]}
          value={activeTab as any}
          onChange={(val: any) => setActiveTab(val)}
        />
      </div>

      {resumeNotice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
          {resumeNotice}
        </div>
      ) : null}

      {activeTab === 'practice' ? (
        <div className="space-y-6 mt-4">
          {/* ── Active session workspace ── */}
          {practiceSession ? (
            <section
              ref={practiceWorkspaceRef}
              tabIndex={-1}
              className="rounded-2xl border-2 border-violet-200 dark:border-violet-500/30 bg-violet-50/50 dark:bg-violet-500/5 p-6 space-y-4 scroll-mt-28 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Active Session</h2>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-violet-100 dark:bg-violet-500/20 px-3 py-1 text-xs font-bold text-violet-700 dark:text-violet-300">
                    {practiceElapsed}s
                  </span>
                  <StatusBadge tone={practiceStatusBadge.tone}>{practiceStatusBadge.label}</StatusBadge>
                </div>
              </div>

              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{practiceSession.question}</p>

              {practiceSession.tips?.length ? (
                <ul className="space-y-1 text-sm text-gray-500 dark:text-gray-400">
                  {practiceSession.tips.slice(0, 4).map(item => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[14px] text-violet-500 mt-0.5">lightbulb</span>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}

              {showPracticeInlineProcessing ? (
                <section
                  ref={practiceInlineSurfaceRef}
                  tabIndex={-1}
                  aria-live="polite"
                  className="rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-white dark:bg-gray-900/80 p-5 space-y-4 scroll-mt-28 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                      <span className="material-symbols-outlined animate-spin text-[22px]">progress_activity</span>
                    </div>
                    <div className="flex-1 space-y-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-gray-900 dark:text-white">Processing your response</h3>
                          <StatusBadge tone="info">Live update</StatusBadge>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Uploading audio, generating a transcript, and scoring your response.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        {[
                          {
                            icon: 'cloud_upload',
                            title: 'Upload in progress',
                            body: 'Your recording is being sent securely for transcription.'
                          },
                          {
                            icon: 'notes',
                            title: 'Transcript draft',
                            body: 'We are turning your audio into editable text.'
                          },
                          {
                            icon: 'analytics',
                            title: 'Band estimate',
                            body: 'Your fluency, vocabulary, grammar, and pronunciation are being reviewed.'
                          }
                        ].map(step => (
                          <div
                            key={step.title}
                            className="rounded-xl border border-blue-100 dark:border-blue-500/15 bg-blue-50/70 dark:bg-blue-500/5 p-4"
                          >
                            <div className="flex items-start gap-3">
                              <span className="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-400">
                                {step.icon}
                              </span>
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{step.title}</p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">{step.body}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}

              {showPracticeInlineError ? (
                <section
                  ref={practiceInlineSurfaceRef}
                  tabIndex={-1}
                  aria-live="assertive"
                  className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-white dark:bg-gray-900/80 p-5 space-y-4 scroll-mt-28 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">
                      <span className="material-symbols-outlined text-[22px]">error</span>
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-gray-900 dark:text-white">We couldn&apos;t process this recording</h3>
                          <StatusBadge tone="danger">Action needed</StatusBadge>
                        </div>
                        <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
                      </div>
                      <div className="rounded-xl border border-red-100 dark:border-red-500/15 bg-red-50/80 dark:bg-red-500/5 p-4">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">Next step</p>
                        <ul className="mt-2 space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                          <li>Review or edit the transcript below, then submit it for scoring.</li>
                          <li>Check the selected microphone and retry the recording if you prefer audio upload.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}

              {showPracticeInlineReview ? (
                <section
                  ref={practiceInlineSurfaceRef}
                  tabIndex={-1}
                  className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-white dark:bg-gray-900/80 p-5 space-y-5 scroll-mt-28 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-400">
                        Practice result
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Review your response</h3>
                        <StatusBadge tone="success">Feedback ready</StatusBadge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Your transcript and score are ready here. Open the full report if you want the dedicated detail page.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 dark:border-emerald-500/15 bg-emerald-50/80 dark:bg-emerald-500/5 px-5 py-4 min-w-[180px]">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
                        Overall band
                      </p>
                      <p className="mt-2 text-4xl font-black tracking-tight text-gray-900 dark:text-white">
                        {practiceFeedback?.overallBand ?? '--'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-950/40 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-600 dark:text-gray-300">
                          Transcript
                        </h4>
                        <StatusBadge tone={practiceTranscription ? 'info' : 'neutral'}>
                          {practiceTranscription ? 'Auto-transcribed' : 'Manual transcript'}
                        </StatusBadge>
                      </div>
                      <p className="text-sm leading-7 text-gray-700 dark:text-gray-300">
                        {practiceReviewTranscript || 'No transcript available yet.'}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-950/40 p-4 space-y-3">
                      <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-600 dark:text-gray-300">
                        Summary
                      </h4>
                      <p className="text-sm leading-7 text-gray-700 dark:text-gray-300">
                        {practiceFeedback?.summary || 'Your response has been scored. Open the full report for more detail.'}
                      </p>
                    </div>
                  </div>

                  {practiceBandRows.length ? (
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      {practiceBandRows.map(row => (
                        <div
                          key={row.label}
                          className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-950/40 px-4 py-3"
                        >
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                            {row.label}
                          </p>
                          <p className="mt-2 text-2xl font-black tracking-tight text-violet-600 dark:text-violet-400">
                            {typeof row.value === 'number' ? row.value.toFixed(1) : '--'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-100 dark:border-emerald-500/15 bg-emerald-50/80 dark:bg-emerald-500/5 p-4">
                      <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
                        Strengths
                      </h4>
                      <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                        {(practiceFeedback?.strengths || []).slice(0, 4).map(item => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="material-symbols-outlined mt-0.5 text-[14px] text-emerald-500">check_circle</span>
                            {item}
                          </li>
                        ))}
                        {practiceFeedback?.strengths?.length ? null : (
                          <li className="text-gray-600 dark:text-gray-400">No strengths were captured for this response.</li>
                        )}
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-amber-100 dark:border-amber-500/15 bg-amber-50/80 dark:bg-amber-500/5 p-4">
                      <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">
                        Next improvements
                      </h4>
                      <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                        {(practiceFeedback?.improvements || []).slice(0, 4).map(item => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="material-symbols-outlined mt-0.5 text-[14px] text-amber-500">arrow_upward</span>
                            {item}
                          </li>
                        ))}
                        {practiceFeedback?.improvements?.length ? null : (
                          <li className="text-gray-600 dark:text-gray-400">No improvement actions were generated for this response.</li>
                        )}
                      </ul>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {practiceDetailHref ? (
                      <Link
                        href={practiceDetailHref}
                        className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
                      >
                        Open full report
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </Link>
                    ) : null}
                    <Link
                      href={buildLibraryHref('collocations', 'speaking', practiceWeaknessSeed)}
                      className="font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      Related collocations
                    </Link>
                    <Link
                      href={buildLibraryHref('vocabulary', 'speaking', practiceWeaknessSeed)}
                      className="font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      Word alternatives
                    </Link>
                  </div>
                </section>
              ) : null}

              <label className="block space-y-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Microphone</span>
                <select
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  value={deviceId}
                  onChange={event => setDeviceId(event.target.value)}
                >
                  <option value="">Default microphone</option>
                  {devices.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microphone ${device.deviceId.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => void startRecording()}
                  disabled={recorderState === 'recording'}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">mic</span>
                  Start Recording
                </button>
                <button
                  onClick={stopRecording}
                  disabled={recorderState !== 'recording'}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">stop</span>
                  Stop + Upload
                </button>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fallback Manual Transcript</span>
                <textarea
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 min-h-[100px]"
                  value={practiceManualResponse}
                  onChange={event => setPracticeManualResponse(event.target.value)}
                  placeholder="Type your answer if microphone permission is denied or device fails"
                />
              </label>
              <button
                onClick={() => void completePracticeSessionWithText()}
                disabled={!canSubmitManualTranscript}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Submit Manual Transcript
              </button>
            </section>
          ) : null}

          {/* Filter pills + search */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 bg-gray-50/50 p-1 rounded-xl border border-gray-100 dark:border-gray-800 dark:bg-gray-800/30">
              {(['all', 'part1', 'part2', 'part3'] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => setTopicCategory(cat)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-bold transition-all ${topicCategory === cat
                    ? 'bg-white shadow-sm text-violet-700 dark:bg-gray-700 dark:text-violet-300 ring-1 ring-gray-200 dark:ring-gray-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700/50'
                    }`}
                >
                  {cat === 'all' ? 'All Topics' : `Part ${cat.replace('part', '')}`}
                </button>
              ))}
            </div>
            <div className="ml-auto relative">
              <span className="material-symbols-outlined text-[20px] text-gray-500 dark:text-gray-400 absolute left-3 top-1/2 -translate-y-1/2">search</span>
              <input
                type="text"
                placeholder="Search topics..."
                value={topicSearch}
                onChange={e => setTopicSearch(e.target.value)}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-10 pr-4 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 w-64"
              />
            </div>
          </div>

          {/* Topic grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTopics.map(topic => (
              <article
                key={topic.slug}
                className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col gap-3 hover:border-gray-300 dark:hover:border-gray-700 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${topic.part === 1
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                    : topic.part === 2
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                    }`}>
                    Part {topic.part}
                  </span>
                  {topic.isPremium ? (
                    <span className="material-symbols-outlined text-[16px] text-amber-500" title="Premium topic">lock</span>
                  ) : null}
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">{topic.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{topic.description || 'No description available.'}</p>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className={`flex items-center gap-1.5 text-xs font-semibold ${topic.difficulty === 'beginner'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : topic.difficulty === 'advanced'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-amber-700 dark:text-amber-300'
                    }`}>
                    <span className={`w-2 h-2 rounded-full ${topic.difficulty === 'beginner'
                      ? 'bg-emerald-500'
                      : topic.difficulty === 'advanced'
                        ? 'bg-red-500'
                        : 'bg-amber-500'
                      }`} />
                    {topic.difficulty ? topic.difficulty.charAt(0).toUpperCase() + topic.difficulty.slice(1) : 'Mixed'}
                  </span>
                  <button
                    onClick={() => void startPracticeSession(topic)}
                    className="text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    Start Practice →
                  </button>
                </div>
              </article>
            ))}
          </div>

          {/* Load more */}
          {hasMoreTopics ? (
            <div className="flex justify-center">
              <button
                onClick={() => void loadTopics(false)}
                disabled={topicLoading}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {topicLoading ? 'Loading...' : 'Load More Topics'}
              </button>
            </div>
          ) : null}

          <SectionCard title="Session History">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px]">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Topic</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Band</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {practiceHistory.map(item => (
                    <tr key={item._id || item.sessionId || `${item.topicId}-${item.createdAt}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-3.5 text-sm font-medium text-gray-900 dark:text-white">{item.topicTitle || item.topicId}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400">
                        <StatusBadge tone={item.status.includes('complete') ? 'success' : 'neutral'}>{item.status}</StatusBadge>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white">{item.feedback?.overallBand ?? '-'}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</td>
                      <td className="px-5 py-3.5">
                        {item._id ? (
                          <Link href={`/app/speaking/history/${item._id}`} className="text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline">
                            Open
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-400">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === 'simulation' ? (
        <div className="space-y-6">
          <AuthenticSimulationStage
            audioContextRef={simulationAudioContextRef}
            devices={devices}
            deviceId={deviceId}
            elapsed={simulationElapsed}
            onComplete={handleSimulationComplete}
            onDeviceChange={setDeviceId}
            onRestart={startSimulation}
            onSessionChange={handleSimulationSessionChange}
            onStart={startSimulation}
            session={simulation}
            starting={simulationStarting}
            workspaceRef={simulationWorkspaceRef}
          />

          {simulationResult ? (
            <article className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5 p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Simulation Result</h3>
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white">Overall Band {simulationResult.overallBand ?? '--'}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{simulationResult.overallFeedback?.summary}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {simulationResult.parts.map(part => (
                  <div key={part.part} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-1.5">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">Part {part.part}</p>
                    <p className="text-xl font-extrabold text-violet-600 dark:text-violet-400">{part.feedback?.overallBand ?? '--'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{part.feedback?.summary}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Link
                  href={buildLibraryHref('collocations', 'speaking', simulationWeaknessSeed)}
                  className="font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Collocations
                </Link>
                <Link
                  href={buildLibraryHref('vocabulary', 'speaking', simulationWeaknessSeed)}
                  className="font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Examples and alternatives
                </Link>
                <Link
                  href="/app/study-plan"
                  className="font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Update study plan
                </Link>
              </div>
            </article>
          ) : null}

          <SectionCard title="Simulation History">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px]">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Band</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {simulationHistory.map(item => (
                    <tr key={item._id || item.simulationId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-3.5 text-sm font-mono text-gray-600 dark:text-gray-400">{(item._id || item.simulationId || '').slice(0, 8)}…</td>
                      <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400">
                        <StatusBadge tone={item.status.includes('complete') ? 'success' : 'neutral'}>{item.status}</StatusBadge>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white">{item.overallBand ?? '-'}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => void loadSimulationDetail(item._id || item.simulationId || '')}
                          className="text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === 'quick' ? (
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Quick Transcript Evaluation</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Paste any speaking response and get instant AI feedback.</p>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Prompt</span>
              <select
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                value={quickQuestion}
                onChange={event => setQuickQuestion(event.target.value)}
              >
                {quickQuestionBank.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <textarea
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 min-h-[140px]"
              value={quickTranscript}
              onChange={event => setQuickTranscript(event.target.value)}
              placeholder="Paste your transcript for direct evaluation"
            />

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void runQuickEvaluation()}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">psychology</span>
                Evaluate Transcript
              </button>
              <button
                onClick={() => void playPromptAudio()}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">volume_up</span>
                Play Prompt (TTS)
              </button>
            </div>

            {ttsAudioUrl ? <audio controls src={ttsAudioUrl} className="w-full mt-2" /> : null}
          </section>

          {quickEvaluation ? (
            <article
              ref={quickEvaluationRef}
              tabIndex={-1}
              className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5 p-6 space-y-3 scroll-mt-28 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Evaluation</h3>
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white">Band {quickEvaluation.overallBand}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{quickEvaluation.spokenSummary}</p>
              {(quickEvaluation.suggestions || []).length > 0 ? (
                <ul className="space-y-1.5">
                  {(quickEvaluation.suggestions || []).slice(0, 4).map((item, index) => (
                    <li key={`${index}-${typeof item === 'string' ? item : item.suggestion || 'tip'}`} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="material-symbols-outlined text-[14px] text-amber-500 mt-0.5">arrow_upward</span>
                      {typeof item === 'string' ? item : item.suggestion || 'Improve response precision.'}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ) : null}
        </div>
      ) : null}

      {showGlobalErrorMessage ? (
        <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400">
          {errorMessage}
        </div>
      ) : null}

      <ActiveAttemptLeaveGuard
        enabled={hasActiveSpeakingAttempt}
        title="Leave speaking attempt?"
        subtitle="We will save your current speaking attempt so you can resume later."
        confirmLabel="Save and Leave"
        cancelLabel="Stay Here"
        onConfirmLeave={saveSpeakingSnapshotForLeave}
      />
    </div>
  );
}
