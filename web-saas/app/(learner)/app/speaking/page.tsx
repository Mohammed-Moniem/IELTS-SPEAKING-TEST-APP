'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import { useAuth } from '@/components/auth/AuthProvider';
import { ApiError, apiRequest } from '@/lib/api/client';
import { PageHeader, SectionCard, StatusBadge, SegmentedTabs, EmptyState } from '@/components/ui/v2';
import {
  PracticeAudioUploadResult,
  PracticeSession,
  PracticeSessionStartPayload,
  PracticeTopic,
  PracticeTopicPage,
  SimulationSession,
  SimulationStartPayload,
  SpeakingEvaluation
} from '@/lib/types';

type SynthesizeResponse = {
  audioBase64: string;
  mimeType: string;
};

type RecorderState = 'idle' | 'recording' | 'uploading' | 'error';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';

const quickQuestionBank = [
  'Describe a skill you learned recently and why it was important.',
  'Talk about a challenge you solved and what you learned from it.',
  'Describe a place in your city that visitors should see and explain why.'
];

const buildLibraryHref = (
  kind: 'collocations' | 'vocabulary' | 'books' | 'channels',
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

export default function SpeakingPage() {
  const { accessToken } = useAuth();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const practiceTimerRef = useRef<number | null>(null);
  const simulationTimerRef = useRef<number | null>(null);
  const partStartedAtRef = useRef<number | null>(null);

  const [activeTab, setActiveTab] = useState<'practice' | 'simulation' | 'quick'>('practice');
  const [errorMessage, setErrorMessage] = useState('');
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

  const [simulation, setSimulation] = useState<SimulationStartPayload | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationSession | null>(null);
  const [simulationHistory, setSimulationHistory] = useState<SimulationSession[]>([]);
  const [simulationPartIndex, setSimulationPartIndex] = useState(0);
  const [simulationResponses, setSimulationResponses] = useState<Record<number, string>>({});
  const [simulationTimeSpent, setSimulationTimeSpent] = useState<Record<number, number>>({});
  const [simulationElapsed, setSimulationElapsed] = useState(0);

  const [quickQuestion, setQuickQuestion] = useState(quickQuestionBank[0]);
  const [quickTranscript, setQuickTranscript] = useState('');
  const [quickEvaluation, setQuickEvaluation] = useState<SpeakingEvaluation | null>(null);
  const [ttsAudioUrl, setTtsAudioUrl] = useState('');

  const supportsMedia = useMemo(
    () => typeof window !== 'undefined' && !!navigator.mediaDevices && typeof window.MediaRecorder !== 'undefined',
    []
  );

  const currentSimulationPart = simulation?.parts?.[simulationPartIndex];

  const refreshDevices = async () => {
    if (!supportsMedia) return;

    const list = await navigator.mediaDevices.enumerateDevices();
    const mics = list.filter(device => device.kind === 'audioinput');
    setDevices(mics);
    if (!deviceId && mics[0]) {
      setDeviceId(mics[0].deviceId);
    }
  };

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

  const startPracticeTimer = () => {
    if (practiceTimerRef.current) {
      window.clearInterval(practiceTimerRef.current);
    }

    setPracticeElapsed(0);
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

  const startSimulationTimer = () => {
    if (simulationTimerRef.current) {
      window.clearInterval(simulationTimerRef.current);
    }

    setSimulationElapsed(0);
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
      await refreshPracticeHistory();
      setRecorderState('idle');
    } catch (error: any) {
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
      const response = await fetch(`${apiBase}/practice/sessions/${practiceSession.sessionId}/audio`, {
        method: 'POST',
        body: formData,
        headers: {
          'Unique-Reference-Code': `web-speaking-practice-audio-${Date.now()}`,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        }
      });

      const payload = (await response.json()) as {
        success: boolean;
        message?: string;
        data?: PracticeAudioUploadResult;
      };

      if (!payload.success || !payload.data) {
        throw new Error(payload.message || 'Practice audio upload failed');
      }

      setPracticeResult(payload.data.session);
      setPracticeTranscription(payload.data.transcription.text);
      stopPracticeTimer();
      setRecorderState('idle');
      await refreshPracticeHistory();
    } catch (error: any) {
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
    setErrorMessage('');
    setSimulationResult(null);
    setSimulationResponses({});
    setSimulationTimeSpent({});
    setSimulationPartIndex(0);

    try {
      const started = await apiRequest<SimulationStartPayload>('/test-simulations', {
        method: 'POST',
        body: JSON.stringify({})
      });

      setSimulation(started);
      partStartedAtRef.current = Date.now();
      startSimulationTimer();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to start speaking simulation.');
    }
  };

  const captureCurrentPartTime = () => {
    if (!simulation || !currentSimulationPart) return;
    if (!partStartedAtRef.current) return;

    const seconds = Math.max(0, Math.round((Date.now() - partStartedAtRef.current) / 1000));
    setSimulationTimeSpent(prev => ({
      ...prev,
      [currentSimulationPart.part]: (prev[currentSimulationPart.part] || 0) + seconds
    }));
    partStartedAtRef.current = Date.now();
  };

  const goToSimulationPart = (index: number) => {
    if (!simulation) return;
    captureCurrentPartTime();
    setSimulationPartIndex(Math.max(0, Math.min(index, simulation.parts.length - 1)));
  };

  const completeSimulation = async () => {
    if (!simulation) return;
    setErrorMessage('');

    captureCurrentPartTime();

    const payload = simulation.parts.map(part => ({
      part: part.part,
      question: part.question,
      response: simulationResponses[part.part] || '',
      timeSpent: simulationTimeSpent[part.part] || 0
    }));

    try {
      const result = await apiRequest<SimulationSession>(`/test-simulations/${simulation.simulationId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ parts: payload })
      });
      stopSimulationTimer();
      setSimulationResult(result);
      await refreshSimulationHistory();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to complete simulation.');
    }
  };

  const loadSimulationDetail = async (simulationId: string) => {
    setErrorMessage('');
    try {
      const detail = await apiRequest<SimulationSession>(`/test-simulations/${simulationId}`);
      setSimulationResult(detail);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Unable to load simulation details.');
    }
  };

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
    return () => {
      stopPracticeTimer();
      stopSimulationTimer();
      stopRecorder();
    };
  }, []);

  const filteredTopics = useMemo(() => {
    if (!topicSearch.trim()) return topics;
    const q = topicSearch.toLowerCase();
    return topics.filter(t => t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
  }, [topics, topicSearch]);

  const practiceWeaknessSeed = useMemo(() => {
    const feedback = practiceResult?.feedback;
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
  }, [practiceResult?.feedback]);

  const simulationWeaknessSeed = useMemo(() => {
    const feedback = simulationResult?.overallFeedback;
    if (!feedback) return '';
    return feedback.improvements?.[0] || feedback.summary || '';
  }, [simulationResult?.overallFeedback]);

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
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/25 transition-all hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-lg"
          >
            <span className="material-symbols-outlined text-[18px]">play_arrow</span>
            Start Full Simulation
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

      {activeTab === 'practice' ? (
        <div className="space-y-6 mt-4">
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

          {/* ── Active session panel ── */}
          {practiceSession ? (
            <section className="rounded-2xl border-2 border-violet-200 dark:border-violet-500/30 bg-violet-50/50 dark:bg-violet-500/5 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Active Session</h2>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-violet-100 dark:bg-violet-500/20 px-3 py-1 text-xs font-bold text-violet-700 dark:text-violet-300">
                    {practiceElapsed}s
                  </span>
                  <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-600 dark:text-gray-400">
                    {recorderState}
                  </span>
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
                disabled={recorderState === 'uploading'}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Submit Manual Transcript
              </button>
            </section>
          ) : null}

          {practiceTranscription ? (
            <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-2">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Transcription</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">{practiceTranscription}</p>
            </article>
          ) : null}

          {practiceResult?.feedback ? (
            <article className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5 p-5 space-y-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Practice Result</h3>
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white">Band {practiceResult.feedback.overallBand || '--'}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{practiceResult.feedback.summary}</p>
              {(practiceResult.feedback.improvements || []).length > 0 ? (
                <ul className="space-y-1.5">
                  {(practiceResult.feedback.improvements || []).slice(0, 4).map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="material-symbols-outlined text-[14px] text-amber-500 mt-0.5">arrow_upward</span>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 text-xs">
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
                <Link
                  href={buildLibraryHref('channels', 'speaking', practiceWeaknessSeed)}
                  className="font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Recommended channels
                </Link>
              </div>
            </article>
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
          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Full Speaking Simulation</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Complete all three IELTS speaking parts in one session with AI evaluation.</p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => void startSimulation()}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                Start Full Simulation
              </button>
              {simulationElapsed > 0 ? (
                <span className="rounded-full bg-violet-100 dark:bg-violet-500/20 px-3 py-1 text-xs font-bold text-violet-700 dark:text-violet-300">
                  {simulationElapsed}s elapsed
                </span>
              ) : null}
            </div>
          </section>

          {simulation ? (
            <section className="rounded-2xl border-2 border-violet-200 dark:border-violet-500/30 bg-violet-50/50 dark:bg-violet-500/5 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Simulation in Progress</h3>
                <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-600 dark:text-gray-400">
                  Part {currentSimulationPart?.part || 1} / {simulation.parts.length}
                </span>
              </div>

              <div className="flex gap-2">
                {simulation.parts.map((part, index) => (
                  <button
                    key={part.part}
                    onClick={() => goToSimulationPart(index)}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${index === simulationPartIndex
                      ? 'bg-violet-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                      }`}
                  >
                    Part {part.part}
                  </button>
                ))}
              </div>

              {currentSimulationPart ? (
                <>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{currentSimulationPart.question}</p>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Your Response</span>
                    <textarea
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 min-h-[120px]"
                      value={simulationResponses[currentSimulationPart.part] || ''}
                      onChange={event =>
                        setSimulationResponses(prev => ({
                          ...prev,
                          [currentSimulationPart.part]: event.target.value
                        }))
                      }
                      placeholder="Write or paste your response for this speaking part"
                    />
                  </label>
                  {currentSimulationPart.tips?.length ? (
                    <ul className="space-y-1 text-sm text-gray-500 dark:text-gray-400">
                      {currentSimulationPart.tips.map(item => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-[14px] text-violet-500 mt-0.5">lightbulb</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => goToSimulationPart(simulationPartIndex - 1)}
                  disabled={simulationPartIndex === 0}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  ← Previous Part
                </button>
                <button
                  onClick={() => goToSimulationPart(simulationPartIndex + 1)}
                  disabled={simulationPartIndex >= simulation.parts.length - 1}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Next Part →
                </button>
                <button
                  onClick={() => void completeSimulation()}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
                >
                  Complete Simulation
                </button>
              </div>
            </section>
          ) : null}

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
                  href={buildLibraryHref('books', 'speaking', simulationWeaknessSeed)}
                  className="font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Resources
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
            <article className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5 p-6 space-y-3">
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

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}
