import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { AuthenticFullTestV2 } from "./AuthenticFullTestV2";

const mockStart = jest.fn();
const mockAdvance = jest.fn();
const mockRetry = jest.fn();
const mockComplete = jest.fn();
const mockTranscribeAudio = jest.fn();
const mockSpeak = jest.fn();
const mockStop = jest.fn();

jest.mock("@expo/vector-icons", () => ({
  Ionicons: ({ name }: { name: string }) => name,
}));

jest.mock("expo-av", () => ({
  Audio: {
    requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
    setAudioModeAsync: jest.fn(async () => undefined),
    Recording: {
      createAsync: jest.fn(async () => ({
        recording: {
          stopAndUnloadAsync: jest.fn(async () => undefined),
          getURI: jest.fn(() => "file:///mock-recording.m4a"),
        },
      })),
    },
  },
}));

jest.mock("../api/services", () => ({
  simulationApi: {
    start: () => mockStart(),
    advanceRuntime: (simulationId: string) => mockAdvance(simulationId),
    answerRuntime: (simulationId: string, payload: any) =>
      Promise.resolve({ simulationId, payload }),
    retryRuntime: (simulationId: string) => mockRetry(simulationId),
    complete: (simulationId: string, parts: any[]) =>
      mockComplete(simulationId, parts),
  },
}));

jest.mock("../api/speechApi", () => ({
  transcribeAudio: (uri: string) => mockTranscribeAudio(uri),
}));

jest.mock("../services/textToSpeechService", () => ({
  ttsService: {
    speak: (...args: any[]) => mockSpeak(...args),
    stop: () => mockStop(),
  },
}));

jest.mock("../utils/logger", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const buildRuntimeResponse = (overrides: Record<string, any> = {}) => ({
  simulationId: "simulation-123",
  status: "in_progress",
  runtime: {
    state: "intro-examiner",
    currentPart: 0,
    currentTurnIndex: 0,
    retryCount: 0,
    retryBudgetRemaining: 1,
    introStep: "welcome",
    seedQuestionIndex: 0,
    followUpCount: 0,
    currentSegment: {
      kind: "cached_phrase",
      phraseId: "welcome_intro",
      text: "Good morning. My name is Anna. I will be your examiner today.",
    },
    ...overrides,
  },
  currentPart: undefined,
});

const buildStartPayload = (runtimeOverrides: Record<string, any> = {}) => ({
  simulationId: "simulation-123",
  parts: [
    {
      part: 1,
      topicId: "hobbies",
      topicTitle: "Hobbies",
      question: "What hobbies do you have?",
      timeLimit: 60,
      tips: ["Keep answers brief"],
    },
    {
      part: 2,
      topicId: "trip",
      topicTitle: "Memorable trip",
      question: "Describe a memorable trip you have taken.",
      timeLimit: 180,
      tips: ["You have 1 minute to prepare"],
    },
    {
      part: 3,
      topicId: "travel",
      topicTitle: "Travel",
      question: "How does travel change people?",
      timeLimit: 120,
      tips: ["Explain your reasons"],
    },
  ],
  runtime: buildRuntimeResponse(runtimeOverrides).runtime,
});

describe("AuthenticFullTestV2", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSpeak.mockImplementation(
      async (_text: string, options?: { onDone?: () => void }) => {
        options?.onDone?.();
      }
    );
    mockStart.mockResolvedValue(buildStartPayload());
    mockAdvance.mockResolvedValue(
      buildRuntimeResponse({
        state: "intro-candidate-turn",
        currentPart: 0,
      })
    );
    mockRetry.mockResolvedValue(
      buildRuntimeResponse({
        state: "part1-examiner",
        currentPart: 1,
        currentSegment: {
          kind: "dynamic_prompt",
          text: "What hobbies do you have?",
        },
      })
    );
    mockComplete.mockResolvedValue({
      _id: "simulation-123",
      status: "completed",
      parts: [],
      overallBand: 6.5,
      overallFeedback: {
        summary: "Solid answer overall.",
        improvements: ["Develop ideas further."],
      },
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockTranscribeAudio.mockResolvedValue({
      text: "My full name is Mohammed Osman.",
      duration: 4,
    });
  });

  it("shows examiner speaking before enabling the learner microphone", async () => {
    const { findByText, findByTestId } = render(
      <AuthenticFullTestV2 onComplete={jest.fn()} onExit={jest.fn()} />
    );

    expect(await findByText("Examiner speaking")).toBeTruthy();
    expect(
      await findByText(
        "Good morning. My name is Anna. I will be your examiner today."
      )
    ).toBeTruthy();

    const startRecordingButton = await findByTestId("start-recording-button");
    await waitFor(() => expect(startRecordingButton).toBeDisabled());
  });

  it("moves from examiner prompt to your-turn microphone stage without manual text entry", async () => {
    const { findByRole, findByText, findByTestId, queryByPlaceholderText } =
      render(<AuthenticFullTestV2 onComplete={jest.fn()} onExit={jest.fn()} />);

    const continueButton = await findByRole("button", {
      name: "Continue after prompt",
    });
    fireEvent.press(continueButton);

    expect(await findByText("Your turn")).toBeTruthy();
    await waitFor(async () =>
      expect(await findByTestId("start-recording-button")).toBeEnabled()
    );
    expect(queryByPlaceholderText("Write your answer")).toBeNull();
  });

  it("shows a retryable pause when the runtime enters paused state", async () => {
    mockStart.mockResolvedValue(
      buildStartPayload({
        state: "paused-retryable",
        currentPart: 1,
        retryCount: 1,
        retryBudgetRemaining: 0,
        previousState: "part1-examiner",
        lastError: "Speech synthesis failed for the current examiner prompt.",
        failedStep: "speech_synthesis",
        currentSegment: {
          kind: "dynamic_prompt",
          text: "What hobbies do you have?",
        },
      })
    );

    const { findByText, findByRole } = render(
      <AuthenticFullTestV2 onComplete={jest.fn()} onExit={jest.fn()} />
    );

    expect(await findByText("Simulation paused")).toBeTruthy();
    expect(
      await findByText("Speech synthesis failed for the current examiner prompt.")
    ).toBeTruthy();
    expect(await findByRole("button", { name: "Retry step" })).toBeTruthy();
  });
});

