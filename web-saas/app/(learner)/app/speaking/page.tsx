'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import { useAuth } from '@/components/auth/AuthProvider';
import { ApiError, apiRequest } from '@/lib/api/client';
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

  const [topicCategory, setTopicCategory] = useState<'part1' | 'part2' | 'part3'>('part1');
  const [topics, setTopics] = useState<PracticeTopic[]>([]);
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
      const page = await apiRequest<PracticeTopicPage>(
        `/topics/practice?limit=9&offset=${nextOffset}&excludeCompleted=true&category=${topicCategory}`
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

  useEffect(() => {
    void loadTopics(true);
    void refreshPracticeHistory();
    void refreshSimulationHistory();
    void refreshDevices();
  }, []);

  useEffect(() => {
    void loadTopics(true);
  }, [topicCategory]);

  useEffect(() => {
    return () => {
      stopPracticeTimer();
      stopSimulationTimer();
      stopRecorder();
    };
  }, []);

  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">Speaking parity complete</span>
        <h1>Practice, simulation, and quick evaluator on existing speaking contracts</h1>
        <p className="subtitle">
          This web flow uses existing authoritative endpoints: `/topics/*`, `/practice/*`, `/test-simulations/*`, and
          `/speech/*`.
        </p>
      </div>

      <article className="panel stack">
        <h3>Recommended session order</h3>
        <div className="grid-3">
          <div className="panel panel-subtle stack">
            <span className="tag">Step 1</span>
            <h4>Practice on one topic</h4>
            <p className="small">Start with a targeted response and focus on clarity under time constraints.</p>
          </div>
          <div className="panel panel-subtle stack">
            <span className="tag">Step 2</span>
            <h4>Run full simulation</h4>
            <p className="small">Complete part progression to train transitions and stamina.</p>
          </div>
          <div className="panel panel-subtle stack">
            <span className="tag">Step 3</span>
            <h4>Use quick evaluator</h4>
            <p className="small">Re-check revised answers before your next full test.</p>
          </div>
        </div>
      </article>

      <div className="panel">
        <div className="cta-row">
          <button className={`btn ${activeTab === 'practice' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('practice')}>
            Practice
          </button>
          <button className={`btn ${activeTab === 'simulation' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('simulation')}>
            Simulation
          </button>
          <button className={`btn ${activeTab === 'quick' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('quick')}>
            Quick Evaluate
          </button>
        </div>
      </div>

      {activeTab === 'practice' ? (
        <div className="stack">
          <div className="panel stack">
            <h3>1. Topic discovery</h3>
            <div className="cta-row">
              <label className="stack">
                <span>IELTS part</span>
                <select className="select" value={topicCategory} onChange={event => setTopicCategory(event.target.value as 'part1' | 'part2' | 'part3')}>
                  <option value="part1">Part 1</option>
                  <option value="part2">Part 2</option>
                  <option value="part3">Part 3</option>
                </select>
              </label>
              <button className="btn btn-secondary" onClick={() => void loadTopics(true)} disabled={topicLoading}>
                Refresh Topics
              </button>
            </div>
            <div className="grid-3">
              {topics.map(topic => (
                <article key={topic.slug} className="panel stack">
                  <h4>{topic.title}</h4>
                  <p className="small">{topic.description || 'No description available.'}</p>
                  <p>
                    <span className="tag">Part {topic.part}</span>
                    <span className="tag">{topic.difficulty || 'mixed'}</span>
                  </p>
                  <button className="btn btn-primary" onClick={() => void startPracticeSession(topic)}>
                    Start Practice
                  </button>
                </article>
              ))}
            </div>
            {hasMoreTopics ? (
              <button className="btn btn-secondary" onClick={() => void loadTopics(false)} disabled={topicLoading}>
                {topicLoading ? 'Loading...' : 'Load More Topics'}
              </button>
            ) : null}
          </div>

          <div className="panel stack">
            <h3>2. Session recording or fallback transcript</h3>
            {practiceSession ? (
              <>
                <p>
                  <span className="tag">Session: {practiceSession.sessionId}</span>
                  <span className="tag">Timer: {practiceElapsed}s</span>
                  <span className="tag">Recorder: {recorderState}</span>
                </p>
                <p>{practiceSession.question}</p>
                {practiceSession.tips?.length ? (
                  <ul>
                    {practiceSession.tips.slice(0, 4).map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}

                <label className="stack">
                  <span>Microphone device</span>
                  <select className="select" value={deviceId} onChange={event => setDeviceId(event.target.value)}>
                    <option value="">Default microphone</option>
                    {devices.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${device.deviceId.slice(0, 6)}`}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="cta-row">
                  <button className="btn btn-primary" onClick={() => void startRecording()} disabled={recorderState === 'recording'}>
                    Start Recording
                  </button>
                  <button className="btn btn-secondary" onClick={stopRecording} disabled={recorderState !== 'recording'}>
                    Stop + Upload
                  </button>
                </div>

                <label className="stack">
                  <span>Fallback manual transcript</span>
                  <textarea
                    className="textarea"
                    value={practiceManualResponse}
                    onChange={event => setPracticeManualResponse(event.target.value)}
                    placeholder="Type your answer if microphone permission is denied or device fails"
                  />
                </label>
                <button className="btn btn-secondary" onClick={() => void completePracticeSessionWithText()} disabled={recorderState === 'uploading'}>
                  Submit Manual Transcript
                </button>
              </>
            ) : (
              <p className="small">Start a topic to begin a speaking practice session.</p>
            )}
          </div>

          {practiceTranscription ? (
            <div className="panel stack">
              <h3>Transcription</h3>
              <p>{practiceTranscription}</p>
            </div>
          ) : null}

          {practiceResult?.feedback ? (
            <div className="panel stack">
              <h3>Practice evaluator result</h3>
              <p className="kpi">Band {practiceResult.feedback.overallBand || '--'}</p>
              <p>{practiceResult.feedback.summary}</p>
              <ul>
                {(practiceResult.feedback.improvements || []).slice(0, 4).map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="panel stack">
            <h3>Session history</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Topic</th>
                    <th>Status</th>
                    <th>Band</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {practiceHistory.map(item => (
                    <tr key={item._id || item.sessionId || `${item.topicId}-${item.createdAt}`}>
                      <td>{item.topicTitle || item.topicId}</td>
                      <td>{item.status}</td>
                      <td>{item.feedback?.overallBand ?? '-'}</td>
                      <td>{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</td>
                      <td>
                        {item._id ? (
                          <Link className="btn btn-secondary" href={`/app/speaking/history/${item._id}`}>
                            Open
                          </Link>
                        ) : (
                          <span className="small">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'simulation' ? (
        <div className="stack">
          <div className="panel stack">
            <h3>Simulation lifecycle</h3>
            <div className="cta-row">
              <button className="btn btn-primary" onClick={() => void startSimulation()}>
                Start Full Speaking Simulation
              </button>
              <span className="tag">Elapsed: {simulationElapsed}s</span>
            </div>
          </div>

          {simulation ? (
            <div className="panel stack">
              <h3>Simulation in progress: {simulation.simulationId}</h3>
              <p>
                <span className="tag">
                  Part {currentSimulationPart?.part || 1} / {simulation.parts.length}
                </span>
              </p>

              <div className="cta-row">
                {simulation.parts.map((part, index) => (
                  <button
                    key={part.part}
                    className={`btn ${index === simulationPartIndex ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => goToSimulationPart(index)}
                  >
                    Part {part.part}
                  </button>
                ))}
              </div>

              {currentSimulationPart ? (
                <>
                  <p>{currentSimulationPart.question}</p>
                  <label className="stack">
                    <span>Your response</span>
                    <textarea
                      className="textarea"
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
                    <ul>
                      {currentSimulationPart.tips.map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : null}

              <div className="cta-row">
                <button className="btn btn-secondary" onClick={() => goToSimulationPart(simulationPartIndex - 1)} disabled={simulationPartIndex === 0}>
                  Previous Part
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => goToSimulationPart(simulationPartIndex + 1)}
                  disabled={simulationPartIndex >= simulation.parts.length - 1}
                >
                  Next Part
                </button>
                <button className="btn btn-primary" onClick={() => void completeSimulation()}>
                  Complete Simulation
                </button>
              </div>
            </div>
          ) : null}

          {simulationResult ? (
            <div className="panel stack">
              <h3>Simulation result</h3>
              <p className="kpi">Overall band {simulationResult.overallBand ?? '--'}</p>
              <p>{simulationResult.overallFeedback?.summary}</p>
              <div className="grid-3">
                {simulationResult.parts.map(part => (
                  <article key={part.part} className="panel stack">
                    <p>
                      <strong>Part {part.part}</strong>
                    </p>
                    <p className="small">Band: {part.feedback?.overallBand ?? '--'}</p>
                    <p className="small">{part.feedback?.summary}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          <div className="panel stack">
            <h3>Simulation history</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Status</th>
                    <th>Band</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {simulationHistory.map(item => (
                    <tr key={item._id || item.simulationId}>
                      <td>{item._id || item.simulationId}</td>
                      <td>{item.status}</td>
                      <td>{item.overallBand ?? '-'}</td>
                      <td>{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</td>
                      <td>
                        <button className="btn btn-secondary" onClick={() => void loadSimulationDetail(item._id || item.simulationId || '')}>
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'quick' ? (
        <div className="stack">
          <div className="panel stack">
            <h3>Quick transcript evaluation</h3>
            <label className="stack">
              <span>Prompt</span>
              <select className="select" value={quickQuestion} onChange={event => setQuickQuestion(event.target.value)}>
                {quickQuestionBank.map(item => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <textarea
              className="textarea"
              value={quickTranscript}
              onChange={event => setQuickTranscript(event.target.value)}
              placeholder="Paste your transcript for direct evaluation"
            />
            <div className="cta-row">
              <button className="btn btn-primary" onClick={() => void runQuickEvaluation()}>
                Evaluate Transcript
              </button>
              <button className="btn btn-secondary" onClick={() => void playPromptAudio()}>
                Play Prompt (TTS)
              </button>
            </div>
            {ttsAudioUrl ? <audio controls src={ttsAudioUrl} /> : null}
          </div>

          {quickEvaluation ? (
            <div className="panel stack">
              <h3>Evaluation</h3>
              <p className="kpi">Band {quickEvaluation.overallBand}</p>
              <p>{quickEvaluation.spokenSummary}</p>
              <ul>
                {(quickEvaluation.suggestions || []).slice(0, 4).map((item, index) => (
                  <li key={`${index}-${typeof item === 'string' ? item : item.suggestion || 'tip'}`}>
                    {typeof item === 'string' ? item : item.suggestion || 'Improve response precision.'}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {errorMessage ? <div className="alert alert-error">{errorMessage}</div> : null}
    </section>
  );
}
