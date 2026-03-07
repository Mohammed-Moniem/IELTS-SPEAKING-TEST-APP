import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { AuthenticFullTestV2 } from "./AuthenticFullTestV2";

const mockStart = jest.fn();
const mockAdvance = jest.fn();
const mockRetry = jest.fn();
const mockComplete = jest.fn();
const mockAnswerRuntime = jest.fn();
const mockTranscribeAudio = jest.fn();
const mockSpeak = jest.fn();
const mockSpeakPackageAudio = jest.fn();
const mockPreloadPackageAudio = jest.fn();
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
    getRuntime: jest.fn(),
    advanceRuntime: (simulationId: string) => mockAdvance(simulationId),
    answerRuntime: (simulationId: string, payload: any) =>
      mockAnswerRuntime(simulationId, payload),
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
    speakPackageAudio: (...args: any[]) => mockSpeakPackageAudio(...args),
    preloadPackageAudio: (...args: any[]) => mockPreloadPackageAudio(...args),
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
  sessionPackage: {
    examinerProfile: {
      id: "british",
      label: "British examiner",
      accent: "British",
      provider: "openai",
      voiceId: "alloy",
      autoAssigned: true,
    },
    segments: [
      {
        segmentId: "welcome-segment",
        part: 0,
        turnType: "examiner",
        kind: "fixed_phrase",
        phraseId: "welcome_intro",
        text: "Good morning. My name is Anna. I will be your examiner today.",
        audioAssetId: "asset-welcome",
        audioUrl:
          "https://cdn.spokio.com/speaking/fixed/british/welcome_intro.mp3",
        canAutoAdvance: true,
      },
      {
        segmentId: "part1-seed-0",
        part: 1,
        turnType: "examiner",
        kind: "seed_prompt",
        text: "What hobbies do you have?",
        audioAssetId: "asset-part1-seed-0",
        audioUrl:
          "https://cdn.spokio.com/speaking/questions/british/part1/hobbies/q0.mp3",
        canAutoAdvance: true,
      },
      {
        segmentId: "part2-intro",
        part: 2,
        turnType: "examiner",
        kind: "part_transition",
        phraseId: "part2_intro",
        text: "Now I am going to give you a topic.",
        audioAssetId: "asset-part2-intro",
        audioUrl:
          "https://cdn.spokio.com/speaking/fixed/british/part2_intro.mp3",
        canAutoAdvance: true,
      },
    ],
  },
});

describe("AuthenticFullTestV2", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSpeak.mockImplementation(
      async (_text: string, options?: { onDone?: () => void }) => {
        options?.onDone?.();
      }
    );
    mockSpeakPackageAudio.mockImplementation(
      async (_audioUrl: string, options?: { onDone?: () => void }) => {
        options?.onDone?.();
      }
    );
    mockPreloadPackageAudio.mockResolvedValue("file:///cache/package-audio.mp3");
    mockStart.mockResolvedValue(buildStartPayload());
    mockAdvance.mockResolvedValue(
      buildRuntimeResponse({
        state: "intro-candidate-turn",
        currentPart: 0,
      })
    );
    mockAnswerRuntime.mockResolvedValue(
      buildRuntimeResponse({
        state: "part1-examiner",
        currentPart: 1,
        currentTurnIndex: 1,
        seedQuestionIndex: 1,
        currentSegment: {
          kind: "dynamic_prompt",
          text: "Why do you enjoy that hobby so much?",
        },
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

  it("plays the current examiner turn from package audio and preloads upcoming package prompts", async () => {
    render(<AuthenticFullTestV2 onComplete={jest.fn()} onExit={jest.fn()} />);

    await waitFor(() =>
      expect(mockSpeakPackageAudio).toHaveBeenCalledWith(
        "https://cdn.spokio.com/speaking/fixed/british/welcome_intro.mp3",
        expect.objectContaining({ onDone: expect.any(Function) })
      )
    );

    await waitFor(() =>
      expect(mockPreloadPackageAudio).toHaveBeenCalledWith(
        "https://cdn.spokio.com/speaking/fixed/british/welcome_intro.mp3"
      )
    );

    await waitFor(() =>
      expect(mockPreloadPackageAudio).toHaveBeenCalledWith(
        "https://cdn.spokio.com/speaking/questions/british/part1/hobbies/q0.mp3"
      )
    );

    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it("falls back to live synthesis for an adaptive follow-up after the learner answer", async () => {
    mockStart.mockResolvedValue({
      ...buildStartPayload(),
      sessionPackage: {
        ...buildStartPayload().sessionPackage,
        examinerProfile: {
          id: "australian",
          label: "Australian examiner",
          accent: "Australian",
          provider: "openai",
          voiceId: "echo",
          autoAssigned: true,
        },
      },
    });

    const { findByRole, findByTestId, findByText } = render(
      <AuthenticFullTestV2 onComplete={jest.fn()} onExit={jest.fn()} />
    );

    fireEvent.press(
      await findByRole("button", { name: "Continue after prompt" })
    );

    await findByText("Your turn");
    const startRecordingButton = await findByTestId("start-recording-button");
    expect(startRecordingButton).toBeEnabled();

    fireEvent.press(startRecordingButton);
    await findByText("Recording in progress.");
    fireEvent.press(await findByRole("button", { name: "Stop + Submit" }));

    await waitFor(() =>
      expect(mockSpeak).toHaveBeenCalledWith(
        "Why do you enjoy that hobby so much?",
        expect.objectContaining({
          onDone: expect.any(Function),
          voiceId: "echo",
        })
      )
    );
  });
});
