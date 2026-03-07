import { apiRequest } from '@/lib/api/client';
import {
  SimulationRuntimeResponse,
  SimulationSession,
  SimulationStartPayload,
  TestSimulationRuntimeState
} from '@/lib/types';

type SynthesizeResponse = {
  audioBase64: string;
  mimeType: string;
};

type TranscriptionResponse = {
  text: string;
  confidence?: number;
  duration?: number;
};

export type LiveSimulationSession = SimulationStartPayload & {
  status?: 'in_progress' | 'completed';
};

export const examinerRuntimeStates: TestSimulationRuntimeState[] = [
  'intro-examiner',
  'part1-examiner',
  'part1-transition',
  'part2-intro',
  'part2-prep',
  'part2-examiner-launch',
  'part2-transition',
  'part3-intro',
  'part3-examiner',
  'evaluation'
];

export const candidateRuntimeStates: TestSimulationRuntimeState[] = [
  'intro-candidate-turn',
  'part1-candidate-turn',
  'part2-candidate-turn',
  'part3-candidate-turn'
];

export const isExaminerRuntimeState = (state: TestSimulationRuntimeState) => examinerRuntimeStates.includes(state);
export const isCandidateRuntimeState = (state: TestSimulationRuntimeState) => candidateRuntimeStates.includes(state);
export const isRetryablePauseState = (state: TestSimulationRuntimeState) => state === 'paused-retryable';
export const isTerminalRuntimeState = (state: TestSimulationRuntimeState) => state === 'failed-terminal';

export const startSimulationRuntime = () =>
  apiRequest<SimulationStartPayload>('/test-simulations', {
    method: 'POST',
    body: JSON.stringify({})
  });

export const getSimulationRuntime = (simulationId: string) =>
  apiRequest<SimulationRuntimeResponse>(`/test-simulations/${simulationId}/runtime`);

export const advanceSimulationRuntime = (simulationId: string) =>
  apiRequest<SimulationRuntimeResponse>(`/test-simulations/${simulationId}/runtime/advance`, {
    method: 'POST',
    body: JSON.stringify({})
  });

export const submitSimulationRuntimeAnswer = (
  simulationId: string,
  payload: { transcript: string; durationSeconds?: number }
) =>
  apiRequest<SimulationRuntimeResponse>(`/test-simulations/${simulationId}/runtime/answer`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

export const retrySimulationRuntimeStep = (simulationId: string) =>
  apiRequest<SimulationRuntimeResponse>(`/test-simulations/${simulationId}/runtime/retry`, {
    method: 'POST',
    body: JSON.stringify({})
  });

export const synthesizeSimulationSegment = (text: string, cacheKey?: string) =>
  apiRequest<SynthesizeResponse>('/speech/synthesize', {
    method: 'POST',
    body: JSON.stringify({
      text,
      cacheKey
    })
  });

export const decodeAudioBase64 = (base64: string, mimeType: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
};

export const transcribeSimulationAudio = async (audioBlob: Blob) => {
  const formData = new FormData();
  const file = new File([audioBlob], `simulation-turn.${audioBlob.type.includes('wav') ? 'wav' : 'webm'}`, {
    type: audioBlob.type || 'audio/webm'
  });
  formData.append('audio', file);
  formData.append('language', 'en');

  return apiRequest<TranscriptionResponse>('/speech/transcribe', {
    method: 'POST',
    body: formData
  });
};

export const mergeRuntimeIntoSimulation = (
  simulation: LiveSimulationSession,
  runtimeResponse: SimulationRuntimeResponse
): LiveSimulationSession => ({
  ...simulation,
  status: runtimeResponse.status,
  runtime: runtimeResponse.runtime
});

export const buildSimulationCompletionPayload = (simulation: LiveSimulationSession) => {
  const turnHistory = simulation.runtime.turnHistory || [];

  return simulation.parts.map(part => {
    const partTurns = turnHistory.filter(turn => turn.part === part.part);
    return {
      part: part.part,
      question: part.question,
      response: partTurns
        .map(turn => turn.transcript?.trim())
        .filter((value): value is string => Boolean(value))
        .join('\n\n'),
      timeSpent: partTurns.reduce((total, turn) => total + (turn.durationSeconds || 0), 0)
    };
  });
};

export const completeSimulationRuntime = (simulation: LiveSimulationSession) =>
  apiRequest<SimulationSession>(`/test-simulations/${simulation.simulationId}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      parts: buildSimulationCompletionPayload(simulation)
    })
  });

