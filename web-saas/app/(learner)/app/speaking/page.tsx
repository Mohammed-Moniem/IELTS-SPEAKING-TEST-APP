'use client';

import { useMemo, useRef, useState } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import { apiRequest, ApiError } from '@/lib/api/client';
import { SpeakingEvaluation } from '@/lib/types';

type RecorderState = 'idle' | 'recording' | 'transcribing' | 'evaluating' | 'done' | 'error';

type SynthesizeResponse = {
  audioBase64: string;
  mimeType: string;
};

const questionBank = [
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

export default function SpeakingPage() {
  const { accessToken } = useAuth();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [state, setState] = useState<RecorderState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [question, setQuestion] = useState(questionBank[0]);
  const [transcript, setTranscript] = useState('');
  const [manualTranscript, setManualTranscript] = useState('');
  const [evaluation, setEvaluation] = useState<SpeakingEvaluation | null>(null);
  const [deviceId, setDeviceId] = useState('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
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

  const cleanupRecorder = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const runTranscriptionAndEvaluation = async (audioChunks: Blob[]) => {
    try {
      setState('transcribing');
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', audioBlob, 'speaking.webm');
      formData.append('language', 'en');

      const transcribeResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1'}/speech/transcribe`, {
        method: 'POST',
        body: formData,
        headers: {
          'Unique-Reference-Code': `web-speaking-transcribe-${Date.now()}`,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        }
      });

      const transcribePayload = (await transcribeResponse.json()) as { success?: boolean; message?: string; data?: { text?: string } };

      if (!transcribePayload.success || !transcribePayload.data?.text) {
        throw new Error(transcribePayload.message || 'Transcription failed');
      }

      const transcriptText = transcribePayload.data.text.trim();
      setTranscript(transcriptText);
      await evaluateTranscript(transcriptText);
    } catch (err: any) {
      setState('error');
      setErrorMessage(err?.message || 'Speech transcription/evaluation failed');
    } finally {
      cleanupRecorder();
    }
  };

  const evaluateTranscript = async (input: string) => {
    setState('evaluating');
    const data = await apiRequest<SpeakingEvaluation>('/speech/evaluate', {
      method: 'POST',
      body: JSON.stringify({ transcript: input, question, testPart: 2 })
    });

    setEvaluation(data);
    setState('done');
  };

  const startRecording = async () => {
    setErrorMessage('');
    setEvaluation(null);
    setTranscript('');
    chunksRef.current = [];

    if (!supportsMedia) {
      setState('error');
      setErrorMessage('This browser does not support microphone recording. Use manual transcript fallback below.');
      return;
    }

    try {
      await refreshDevices();
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
        void runTranscriptionAndEvaluation(chunksRef.current);
      };

      recorder.start(250);
      setState('recording');
    } catch (err: any) {
      setState('error');
      setErrorMessage(err?.message || 'Microphone access denied or no audio input found.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const runManualEvaluation = async () => {
    setErrorMessage('');
    setEvaluation(null);
    try {
      await evaluateTranscript(manualTranscript.trim());
      setTranscript(manualTranscript.trim());
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Manual evaluation failed';
      setState('error');
      setErrorMessage(message);
    }
  };

  const playPromptAudio = async () => {
    try {
      const tts = await apiRequest<SynthesizeResponse>('/speech/synthesize', {
        method: 'POST',
        body: JSON.stringify({ text: question })
      });
      const blob = decodeAudioBase64(tts.audioBase64, tts.mimeType || 'audio/mpeg');
      const url = URL.createObjectURL(blob);
      setTtsAudioUrl(url);

      const audio = new Audio(url);
      await audio.play();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Prompt TTS failed');
    }
  };

  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">Speaking parity</span>
        <h1>Speaking practice with microphone + fallback safety</h1>
        <p className="subtitle">
          Uses existing speaking contracts (`/speech/transcribe`, `/speech/evaluate`, `/speech/synthesize`) without
          changing backend speaking semantics.
        </p>
      </div>

      <div className="panel stack">
        <label className="stack">
          <span>Prompt</span>
          <select className="select" value={question} onChange={event => setQuestion(event.target.value)}>
            {questionBank.map(item => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="stack">
          <span>Audio input device</span>
          <select className="select" value={deviceId} onChange={e => setDeviceId(e.target.value)}>
            <option value="">Default microphone</option>
            {devices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${device.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
        </label>

        <div className="cta-row">
          <button className="btn btn-primary" onClick={() => void startRecording()} disabled={state === 'recording'}>
            Start Recording
          </button>
          <button className="btn btn-secondary" onClick={stopRecording} disabled={state !== 'recording'}>
            Stop + Evaluate
          </button>
          <button className="btn btn-secondary" onClick={() => void playPromptAudio()}>
            Play Prompt (TTS)
          </button>
        </div>

        <p className="small">
          Current state: <strong>{state}</strong>
        </p>

        {ttsAudioUrl ? <audio controls src={ttsAudioUrl} /> : null}
      </div>

      <div className="panel stack">
        <h3>Fallback: manual transcript evaluation</h3>
        <p className="small">Use this path if permission is denied or your microphone device fails.</p>
        <textarea
          className="textarea"
          value={manualTranscript}
          onChange={event => setManualTranscript(event.target.value)}
          placeholder="Paste or type your response transcript here"
        />
        <div className="cta-row">
          <button className="btn btn-secondary" onClick={() => void runManualEvaluation()} disabled={manualTranscript.trim().length < 8}>
            Evaluate Manual Transcript
          </button>
        </div>
      </div>

      {errorMessage ? <div className="alert alert-error">{errorMessage}</div> : null}

      {transcript ? (
        <div className="panel stack">
          <h3>Transcript</h3>
          <p>{transcript}</p>
        </div>
      ) : null}

      {evaluation ? (
        <div className="panel stack">
          <h3>Evaluation</h3>
          <p className="kpi">Band {evaluation.overallBand}</p>
          <p>{evaluation.spokenSummary}</p>
          <ul>
            {(evaluation.suggestions || []).slice(0, 3).map((item, index) => (
              <li key={`${index}-${typeof item === 'string' ? item : item.suggestion || 'tip'}`}>
                {typeof item === 'string' ? item : item.suggestion || 'Improve response precision.'}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
