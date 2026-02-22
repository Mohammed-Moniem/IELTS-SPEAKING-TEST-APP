'use client';

import { useMemo, useState } from 'react';

import { apiRequest } from '@/lib/api/client';
import { SpeakingEvaluation } from '@/lib/types';

type RecorderState = 'idle' | 'recording' | 'uploading' | 'done' | 'error';

export default function SpeakingPage() {
  const [state, setState] = useState<RecorderState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [transcript, setTranscript] = useState('');
  const [evaluation, setEvaluation] = useState<SpeakingEvaluation | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [chunks, setChunks] = useState<Blob[]>([]);

  const supportsMedia = useMemo(
    () => typeof window !== 'undefined' && !!navigator.mediaDevices && !!window.MediaRecorder,
    []
  );

  const beginRecording = async () => {
    setErrorMessage('');
    setEvaluation(null);
    setTranscript('');

    if (!supportsMedia) {
      setErrorMessage('Microphone recording is not supported in this browser.');
      setState('error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const localChunks: Blob[] = [];

      recorder.ondataavailable = event => {
        if (event.data.size > 0) {
          localChunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setChunks(localChunks);
        await runEvaluation(localChunks);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setState('recording');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Microphone permission denied or unavailable.');
      setState('error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && state === 'recording') {
      mediaRecorder.stop();
      setState('uploading');
    }
  };

  const runEvaluation = async (recordedChunks: Blob[]) => {
    try {
      setState('uploading');

      const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', audioBlob, 'speaking.webm');
      formData.append('language', 'en');

      const transcribeResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1'}/speech/transcribe`, {
        method: 'POST',
        headers: {
          'Unique-Reference-Code': `web-saas-speaking-${Date.now()}`
        },
        body: formData
      });

      const transcribePayload = await transcribeResponse.json();
      if (!transcribePayload.success || !transcribePayload.data?.text) {
        throw new Error(transcribePayload.message || 'Transcription failed.');
      }

      const transcriptText = transcribePayload.data.text as string;
      setTranscript(transcriptText);

      const evaluationData = await apiRequest<SpeakingEvaluation>('/speech/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          transcript: transcriptText,
          question: 'Tell me about a recent challenge you solved.',
          testPart: 2
        })
      });

      setEvaluation(evaluationData);
      setState('done');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Speaking evaluation failed.');
      setState('error');
    }
  };

  return (
    <section>
      <h1>Speaking</h1>
      <p className="subtitle">
        Browser recording + transcription + evaluation against existing speaking APIs. This flow is additive and does not
        alter mobile speaking contracts.
      </p>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <span className="tag">Parity-safe endpoint usage</span>
        <span className="tag">Mic fallback included</span>
        <p style={{ marginTop: '0.75rem' }}>
          Prompt: <strong>Tell me about a recent challenge you solved.</strong>
        </p>
        <div className="cta-row">
          <button className="btn btn-primary" onClick={beginRecording} disabled={state === 'recording' || state === 'uploading'}>
            Start Recording
          </button>
          <button className="btn btn-secondary" onClick={stopRecording} disabled={state !== 'recording'}>
            Stop and Evaluate
          </button>
        </div>
        <p style={{ marginTop: '0.75rem' }}>
          State: <strong>{state}</strong>{' '}
          {chunks.length > 0 ? <span>({chunks.length} audio chunk{chunks.length > 1 ? 's' : ''})</span> : null}
        </p>
        {errorMessage ? <p className="warning">{errorMessage}</p> : null}
      </div>

      {transcript ? (
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <h3>Transcript</h3>
          <p>{transcript}</p>
        </div>
      ) : null}

      {evaluation ? (
        <div className="panel">
          <h3>Evaluation</h3>
          <p className="kpi">Band {evaluation.overallBand}</p>
          <p>{evaluation.spokenSummary}</p>
          <p>{evaluation.suggestions?.[0] || 'No additional suggestions returned.'}</p>
        </div>
      ) : null}
    </section>
  );
}
