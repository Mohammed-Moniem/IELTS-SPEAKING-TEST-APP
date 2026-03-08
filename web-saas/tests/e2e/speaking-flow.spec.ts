import { expect, test, type Page } from '@playwright/test';

import { bootstrapSession, mockAppConfig, mockJsonSuccess, mockUsageSummary } from './helpers/mockApi';

const practiceSessionId = '507f1f77bcf86cd799439012';

type MediaMockOptions = {
  getUserMediaErrorName?: string;
  getUserMediaErrorMessage?: string;
  recorderConstructorErrorName?: string;
  recorderConstructorErrorMessage?: string;
  recorderStartErrorName?: string;
  recorderStartErrorMessage?: string;
  devices?: Array<{ kind: string; deviceId: string; label: string }>;
};

const installMockMediaStack = async (page: Page, options: MediaMockOptions = {}) => {
  await page.addInitScript(
    opts => {
      (window as typeof window & { __mockGetUserMediaCalls?: number }).__mockGetUserMediaCalls = 0;

      const devices =
        opts.devices && opts.devices.length > 0
          ? opts.devices
          : [{ kind: 'audioinput', deviceId: 'mic-1', label: 'Mock Microphone' }];

      const createNamedError = (name: string, message: string) => {
        const error = new Error(message) as Error & { name: string };
        error.name = name;
        return error;
      };

      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          enumerateDevices: async () => devices,
          getUserMedia: async () => {
            (window as typeof window & { __mockGetUserMediaCalls?: number }).__mockGetUserMediaCalls =
              ((window as typeof window & { __mockGetUserMediaCalls?: number }).__mockGetUserMediaCalls || 0) + 1;

            if (opts.getUserMediaErrorName) {
              throw createNamedError(opts.getUserMediaErrorName, opts.getUserMediaErrorMessage || 'Media error');
            }
            return {
              getTracks: () => [{ stop: () => undefined }]
            };
          }
        }
      });

      class FakeMediaRecorder {
        public state = 'inactive';
        public ondataavailable: ((event: { data: Blob }) => void) | null = null;
        public onstop: (() => void) | null = null;

        constructor(_: unknown) {
          if (opts.recorderConstructorErrorName) {
            throw createNamedError(
              opts.recorderConstructorErrorName,
              opts.recorderConstructorErrorMessage || 'Recorder constructor error'
            );
          }
        }

        public start() {
          if (opts.recorderStartErrorName) {
            throw createNamedError(
              opts.recorderStartErrorName,
              opts.recorderStartErrorMessage || 'Recorder start error'
            );
          }

          this.state = 'recording';
          if (this.ondataavailable) {
            this.ondataavailable({
              data: new Blob(['mock-audio'], { type: 'audio/webm' })
            });
          }
        }

        public stop() {
          this.state = 'inactive';
          if (this.onstop) {
            this.onstop();
          }
        }
      }

      Object.defineProperty(window, 'MediaRecorder', {
        configurable: true,
        value: FakeMediaRecorder
      });
    },
    { ...options }
  );
};

const installMockAudioContextPlayback = async (
  page: Page,
  options: {
    fireEnded?: boolean;
    analyserSpeechReads?: number;
  } = {}
) => {
  await page.addInitScript(
    ({ fireEnded, analyserSpeechReads }) => {
    type MockWindow = typeof window & {
      __mockAudioContextStarts?: number;
      webkitAudioContext?: typeof AudioContext;
    };

    class FakeBufferSource {
      public buffer: unknown = null;
      public onended: (() => void) | null = null;

      public connect() {
        return undefined;
      }

      public disconnect() {
        return undefined;
      }

      public start() {
        (window as MockWindow).__mockAudioContextStarts = ((window as MockWindow).__mockAudioContextStarts || 0) + 1;
        if (fireEnded !== false) {
          window.setTimeout(() => {
            this.onended?.();
          }, 10);
        }
      }

      public stop() {
        return undefined;
      }
    }

    class FakeAudioContext {
      public state: AudioContextState = 'running';
      public destination = {} as AudioDestinationNode;

      public resume() {
        this.state = 'running';
        return Promise.resolve();
      }

      public decodeAudioData(arrayBuffer: ArrayBuffer) {
        return Promise.resolve({
          duration: arrayBuffer.byteLength / 1000
        } as AudioBuffer);
      }

      public createBufferSource() {
        return new FakeBufferSource() as unknown as AudioBufferSourceNode;
      }

      public createMediaStreamSource() {
        return {
          connect() {
            return undefined;
          },
          disconnect() {
            return undefined;
          }
        } as unknown as MediaStreamAudioSourceNode;
      }

      public createAnalyser() {
        let readCount = 0;

        return {
          fftSize: 2048,
          frequencyBinCount: 1024,
          connect() {
            return undefined;
          },
          disconnect() {
            return undefined;
          },
          getByteTimeDomainData(array: Uint8Array) {
            readCount += 1;
            array.fill(128);

            if ((analyserSpeechReads ?? 0) > 0 && readCount <= (analyserSpeechReads ?? 0)) {
              array[0] = 160;
              array[1] = 96;
            }
          }
        } as unknown as AnalyserNode;
      }
    }

    (window as MockWindow).__mockAudioContextStarts = 0;
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: FakeAudioContext
    });
    Object.defineProperty(window, 'webkitAudioContext', {
      configurable: true,
      value: FakeAudioContext
    });
    },
    { fireEnded: options.fireEnded ?? true, analyserSpeechReads: options.analyserSpeechReads ?? 0 }
  );
};

const installMockAudioPlayback = async (page: Page) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value() {
        window.setTimeout(() => {
          this.dispatchEvent(new Event('ended'));
        }, 10);
        return Promise.resolve();
      }
    });

    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value() {
        return undefined;
      }
    });
  });
};

const buildSpeakingSessionPackage = (overrides?: {
  examinerProfileId?: string;
  examinerProfileLabel?: string;
  examinerAccent?: string;
  examinerVoiceId?: string;
  welcomeText?: string;
  firstQuestionText?: string;
  welcomeAudioUrl?: string;
  firstQuestionAudioUrl?: string;
  extraSegments?: Array<Record<string, unknown>>;
}) => ({
  version: 1,
  preparedAt: '2026-03-07T00:00:00.000Z',
  examinerProfile: {
    id: overrides?.examinerProfileId || 'british',
    label: overrides?.examinerProfileLabel || 'British Examiner',
    accent: overrides?.examinerAccent || 'British',
    provider: 'openai',
    voiceId: overrides?.examinerVoiceId || 'alloy',
    autoAssigned: true
  },
  segments: [
    {
      segmentId: 'fixed:welcome_intro',
      part: 0,
      phase: 'check-in',
      kind: 'fixed_phrase',
      turnType: 'examiner',
      canAutoAdvance: true,
      phraseId: 'welcome_intro',
      text: overrides?.welcomeText || 'Good morning. My name is Anna. I will be your examiner today.',
      audioAssetId: 'asset-welcome',
      audioUrl: overrides?.welcomeAudioUrl || 'https://cdn.spokio.com/speaking/fixed/british/welcome_intro.mp3',
      cacheKey: 'fixed:british:welcome_intro',
      provider: 'openai'
    },
    {
      segmentId: 'part1:weather:question-0',
      part: 1,
      phase: 'question-seed',
      kind: 'seed_prompt',
      turnType: 'examiner',
      canAutoAdvance: true,
      promptIndex: 0,
      text: overrides?.firstQuestionText || 'What kind of weather do you enjoy most?',
      audioAssetId: 'asset-part1-q1',
      audioUrl:
        overrides?.firstQuestionAudioUrl || 'https://cdn.spokio.com/speaking/questions/british/part1/weather-question-0.mp3',
      cacheKey: 'question:british:part1:weather:0:what-kind-of-weather-do-you-enjoy-most',
      provider: 'openai'
    },
    ...(overrides?.extraSegments || [])
  ]
});

const mockSpeakingRoutes = async (page: Page) => {
  await page.route('**/api/v1/topics/practice**', route =>
    route.fulfill(
      mockJsonSuccess({
        topics: [
          {
            slug: 'memorable-trip',
            title: 'Memorable Trip',
            description: 'Describe a memorable trip you took.',
            part: 2,
            difficulty: 'medium'
          }
        ],
        total: 1,
        hasMore: false,
        limit: 9,
        offset: 0
      })
    )
  );

  await page.route('**/api/v1/practice/sessions?**', route =>
    route.fulfill(
      mockJsonSuccess([
        {
          _id: practiceSessionId,
          topicId: 'memorable-trip',
          topicTitle: 'Memorable Trip',
          question: 'Describe a memorable trip you took.',
          status: 'completed',
          feedback: {
            overallBand: 6.5,
            summary: 'Good structure and a clear narrative.',
            improvements: ['Use a wider range of linking phrases']
          },
          createdAt: '2026-02-01T10:00:00.000Z'
        }
      ])
    )
  );

  await page.route('**/api/v1/practice/sessions/*', async route => {
    if (route.request().method() !== 'GET') {
      return route.fallback();
    }

    return route.fulfill(
      mockJsonSuccess({
        _id: practiceSessionId,
        topicId: 'memorable-trip',
        topicTitle: 'Memorable Trip',
        question: 'Describe a memorable trip you took.',
        status: 'completed',
        userResponse: 'I travelled and explained my experience clearly.',
        feedback: {
          overallBand: 6.5,
          summary: 'Good structure and a clear narrative.',
          strengths: ['Clear sequence'],
          improvements: ['Use richer collocations'],
          bandBreakdown: {
            pronunciation: 6.5,
            fluency: 6.5,
            lexicalResource: 6.0,
            grammaticalRange: 6.5
          }
        },
        createdAt: '2026-02-01T10:00:00.000Z',
        completedAt: '2026-02-01T10:10:00.000Z'
      })
    );
  });

  await page.route('**/api/v1/test-simulations?**', route => route.fulfill(mockJsonSuccess([])));

  await page.route('**/api/v1/test-simulations', async route => {
    if (route.request().method() !== 'POST') {
      return route.fallback();
    }

    return route.fulfill(
      mockJsonSuccess(
        {
          simulationId: 'simulation-123',
          parts: [
            {
              part: 1,
              question: 'Tell me about your hometown.',
              tips: ['Answer directly', 'Add one specific example']
            },
            {
              part: 2,
              question: 'Describe a memorable trip you took.',
              tips: ['Use a clear sequence', 'Include what you learned']
            },
            {
              part: 3,
              question: 'How does travel change people?',
              tips: ['Compare viewpoints', 'Explain wider impact']
            }
          ],
          runtime: {
            state: 'intro-examiner',
            currentPart: 0,
            currentTurnIndex: 0,
            retryCount: 0,
            retryBudgetRemaining: 1,
            introStep: 'welcome',
            seedQuestionIndex: 0,
            followUpCount: 0,
            currentSegment: {
              kind: 'cached_phrase',
              phraseId: 'welcome_intro',
              text: 'Good morning. My name is Anna. I will be your examiner today.'
            }
          }
        },
        201,
        'Simulation started'
      )
    );
  });

  await page.route('**/api/v1/test-simulations/*/runtime/advance', route =>
    route.fulfill(
      mockJsonSuccess({
        simulationId: 'simulation-123',
        status: 'in_progress',
        runtime: {
          state: 'intro-candidate-turn',
          currentPart: 0,
          currentTurnIndex: 0,
          retryCount: 0,
          retryBudgetRemaining: 1,
          introStep: 'welcome',
          seedQuestionIndex: 0,
          followUpCount: 0,
          currentSegment: {
            kind: 'cached_phrase',
            phraseId: 'welcome_intro',
            text: 'Good morning. My name is Anna. I will be your examiner today.'
          }
        }
      })
    )
  );

  await page.route('**/api/v1/speech/synthesize', route =>
    route.fulfill(
      mockJsonSuccess({
        audioBase64: 'bW9jay1hdWRpbw==',
        mimeType: 'audio/mpeg'
      })
    )
  );

  await page.route('**/api/v1/speech/evaluate', async route =>
    route.fulfill(
      mockJsonSuccess({
        overallBand: 6.5,
        spokenSummary: 'Clear answer with room for stronger vocabulary choices.',
        suggestions: ['Add more precise vocabulary']
      })
    )
  );

  await page.route('**/api/v1/practice/sessions', async route => {
    if (route.request().method() !== 'POST') {
      return route.fallback();
    }

    return route.fulfill(
      mockJsonSuccess(
        {
          sessionId: practiceSessionId,
          question: 'Describe a memorable trip you took.',
          timeLimit: 120,
          tips: ['Give specific details', 'Use past-tense linking phrases'],
          topic: {
            slug: 'memorable-trip',
            title: 'Memorable Trip',
            part: 2
          }
        },
        201,
        'Practice session started'
      )
    );
  });

  await page.route('**/api/v1/practice/sessions/*/complete', route =>
    route.fulfill(
      mockJsonSuccess(
        {
          _id: practiceSessionId,
          topicId: 'memorable-trip',
          status: 'completed',
          feedback: {
            overallBand: 6.5,
            summary: 'Good structure and a clear narrative.',
            improvements: ['Use a wider range of linking phrases']
          }
        },
        200,
        'Practice session completed'
      )
    )
  );
};

test.describe('Speaking flow', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapSession(page);
    await mockAppConfig(page);
    await mockUsageSummary(page);
    await mockSpeakingRoutes(page);
  });

  test('completes speaking practice with manual transcript fallback', async ({ page }) => {
    await page.goto('/app/speaking');

    await expect(page.getByRole('heading', { name: /Speaking Practice/i })).toBeVisible();
    await page.getByRole('button', { name: 'Start Practice' }).first().click();

    await expect(page.getByRole('heading', { name: 'Active Session' })).toBeVisible();
    await page
      .getByPlaceholder('Type your answer if microphone permission is denied or device fails')
      .fill('I visited Istanbul last year and explored the historical districts with my family.');

    await page.getByRole('button', { name: 'Submit Manual Transcript' }).click();

    await expect(page.getByRole('heading', { name: 'Review your response' })).toBeVisible();
    await expect(page.getByText('Good structure and a clear narrative.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open full report' })).toBeVisible();

    await page.getByRole('link', { name: 'Open' }).first().click();
    await expect(page.getByRole('heading', { name: /Speaking session report|Memorable Trip/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Why this score happened' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your transcript' })).toBeVisible();
  });

  test('keeps manual submit disabled until transcript text is present', async ({ page }) => {
    await page.goto('/app/speaking');

    await page.getByRole('button', { name: 'Start Practice' }).first().click();

    const transcriptField = page.getByPlaceholder('Type your answer if microphone permission is denied or device fails');
    const submitButton = page.getByRole('button', { name: 'Submit Manual Transcript' });

    await expect(transcriptField).toHaveValue('');
    await expect(submitButton).toBeDisabled();

    await transcriptField.fill('I visited Istanbul with my family and learned a lot from the trip.');
    await expect(submitButton).toBeEnabled();
  });

  test('refreshes audio upload auth and copies the transcription into the manual transcript field', async ({ page }) => {
    await installMockMediaStack(page);

    let audioUploadCalls = 0;

    await page.route('**/api/v1/practice/sessions/*/audio', async route => {
      audioUploadCalls += 1;
      const authHeader = route.request().headers().authorization;

      if (audioUploadCalls === 1) {
        expect(authHeader).toBe('Bearer playwright-access-token');
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 401,
            success: false,
            message: 'Access token expired',
            error: {
              code: 'AUTH.TokenExpired',
              message: 'Access token expired'
            }
          })
        });
      }

      expect(authHeader).toBe('Bearer refreshed-access-token');
      return route.fulfill(
        mockJsonSuccess({
          session: {
            _id: practiceSessionId,
            sessionId: practiceSessionId,
            topicId: 'memorable-trip',
            topicTitle: 'Memorable Trip',
            status: 'completed',
            feedback: {
              overallBand: 6.5,
              summary: 'Good structure and a clear narrative.',
              improvements: ['Use a wider range of linking phrases']
            }
          },
          transcription: {
            text: 'I visited Istanbul with my family and described the trip clearly.'
          }
        })
      );
    });

    await page.route('**/api/v1/auth/refresh', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      return route.fulfill(
        mockJsonSuccess({
          accessToken: 'refreshed-access-token',
          refreshToken: 'refreshed-refresh-token',
          user: {
            _id: '507f1f77bcf86cd799439011',
            email: 'learner@example.com',
            firstName: 'Playwright',
            lastName: 'Learner',
            subscriptionPlan: 'premium',
            adminRoles: []
          }
        })
      );
    });

    await page.goto('/app/speaking');
    await page.getByRole('button', { name: 'Start Practice' }).first().click();
    await page.getByRole('button', { name: 'Start Recording' }).click();
    await page.getByRole('button', { name: 'Stop + Upload' }).click();

    const transcriptField = page.getByPlaceholder('Type your answer if microphone permission is denied or device fails');
    await expect(transcriptField).toHaveValue('I visited Istanbul with my family and described the trip clearly.');
    await expect(page.getByRole('button', { name: 'Submit Manual Transcript' })).toBeEnabled();
    await expect(page.getByRole('heading', { name: 'Review your response' })).toBeVisible();
    expect(audioUploadCalls).toBe(2);
  });

  test('surfaces a prominent upload state and inline review after recording', async ({ page }) => {
    await installMockMediaStack(page);

    let releaseUpload: () => void = () => {};
    const uploadReleased = new Promise<void>(resolve => {
      releaseUpload = resolve;
    });

    await page.route('**/api/v1/practice/sessions/*/audio', async route => {
      await uploadReleased;
      return route.fulfill(
        mockJsonSuccess({
          session: {
            _id: practiceSessionId,
            sessionId: practiceSessionId,
            topicId: 'memorable-trip',
            topicTitle: 'Memorable Trip',
            question: 'Describe a memorable trip you took.',
            status: 'completed',
            feedback: {
              overallBand: 6.5,
              summary: 'Good structure and a clear narrative.',
              strengths: ['Clear narrative arc'],
              improvements: ['Use a wider range of linking phrases'],
              bandBreakdown: {
                pronunciation: 6.5,
                fluency: 6.5,
                lexicalResource: 6.0,
                grammaticalRange: 6.5
              }
            }
          },
          transcription: {
            text: 'I visited Istanbul with my family and described the trip clearly.'
          }
        })
      );
    });

    await page.goto('/app/speaking');
    await page.getByRole('button', { name: 'Start Practice' }).first().click();
    await page.getByRole('button', { name: 'Start Recording' }).click();
    await page.getByRole('button', { name: 'Stop + Upload' }).click();

    await expect(page.getByRole('heading', { name: 'Processing your response' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Processing your response' })).toBeInViewport();
    await expect(page.getByText('Uploading audio, generating a transcript, and scoring your response.')).toBeVisible();

    releaseUpload();

    await expect(page.getByRole('heading', { name: 'Review your response' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Review your response' })).toBeInViewport();
    await expect(page.getByRole('heading', { name: 'Transcript' })).toBeVisible();
    await expect(page.getByText('Auto-transcribed')).toBeVisible();
    await expect(page.getByText('Good structure and a clear narrative.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open full report' })).toBeVisible();
  });

  test('renders the speaking full report as a coaching debrief', async ({ page }) => {
    await page.goto(`/app/speaking/history/${practiceSessionId}`);

    await expect(page.getByRole('heading', { name: /Speaking session report|Memorable Trip/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Why this score happened' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your transcript' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Example stronger answer' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Practice again', exact: true }).first()).toBeVisible();
  });

  test('keeps speaking workspaces and results in view when actions start', async ({ page }) => {
    await installMockMediaStack(page);

    await page.goto('/app/speaking');

    await page.getByRole('button', { name: 'Start Practice' }).first().click();
    await expect(page.getByRole('heading', { name: 'Active Session' })).toBeInViewport();

    await page.getByRole('tab', { name: 'Simulation' }).click();
    await page.getByRole('button', { name: 'Start Full Simulation' }).first().click();
    await expect(page.getByRole('heading', { name: 'Simulation in Progress' })).toBeInViewport();

    await page.getByRole('tab', { name: 'Quick Evaluate' }).click();
    await page
      .getByPlaceholder('Paste your transcript for direct evaluation')
      .fill('I recently learned how to manage my time better by planning each day in advance.');
    await page.getByRole('button', { name: 'Evaluate Transcript' }).click();

    await expect(page.getByRole('heading', { name: 'Evaluation', exact: true })).toBeInViewport();
  });

  test('shows a visible preparing state while full simulation is starting', async ({ page }) => {
    await installMockMediaStack(page);
    await installMockAudioContextPlayback(page);

    let releaseSimulationStart: () => void = () => {};
    const simulationStartReleased = new Promise<void>(resolve => {
      releaseSimulationStart = resolve;
    });

    await page.route('**/api/v1/test-simulations', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      await simulationStartReleased;

      return route.fulfill(
        mockJsonSuccess(
          {
            simulationId: 'simulation-123',
            parts: [
              {
                part: 1,
                question: 'Tell me about your hometown.',
                tips: ['Answer directly', 'Add one specific example']
              },
              {
                part: 2,
                question: 'Describe a memorable trip you took.',
                tips: ['Use a clear sequence', 'Include what you learned']
              },
              {
                part: 3,
                question: 'How does travel change people?',
                tips: ['Compare viewpoints', 'Explain wider impact']
              }
            ],
            runtime: {
              state: 'intro-examiner',
              currentPart: 0,
              currentTurnIndex: 0,
              retryCount: 0,
              retryBudgetRemaining: 1,
              introStep: 'welcome',
              seedQuestionIndex: 0,
              followUpCount: 0,
              currentSegment: {
                kind: 'cached_phrase',
                phraseId: 'welcome_intro',
                text: 'Good morning. My name is Anna. I will be your examiner today.'
              }
            }
          },
          201,
          'Simulation started'
        )
      );
    });

    await page.goto('/app/speaking');
    await page.getByRole('tab', { name: 'Simulation' }).click();
    await page.getByRole('button', { name: 'Start Full Simulation' }).first().click();

    await expect(page.getByRole('button', { name: 'Preparing simulation...' }).first()).toBeDisabled();
    await expect(page.getByRole('heading', { name: 'Preparing your full simulation' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Preparing your full simulation' })).toBeInViewport();
    await expect(
      page.getByText('We are building all three speaking parts and saving your timer state.')
    ).toBeVisible();

    releaseSimulationStart();

    await expect(page.getByRole('heading', { name: 'Simulation in Progress' })).toBeVisible();
  });

  test('opens a completed simulation from history into the detailed report page', async ({ page }) => {
    await page.route('**/api/v1/test-simulations?limit=8&offset=0', route =>
      route.fulfill(
        mockJsonSuccess([
          {
            _id: 'simulation-report-123',
            simulationId: 'simulation-report-123',
            status: 'completed',
            overallBand: 6.5,
            createdAt: '2026-03-08T08:00:00.000Z',
            overallFeedback: {
              summary: 'Band 6.5 with stronger performance in Part 2 than Parts 1 and 3.'
            },
            parts: [
              {
                part: 1,
                question: 'Tell me about your hometown.',
                feedback: {
                  overallBand: 6.0,
                  summary: 'Clear but could be more specific.'
                }
              },
              {
                part: 2,
                question: 'Describe a memorable trip you took.',
                feedback: {
                  overallBand: 6.5,
                  summary: 'Good coherence across the long turn.'
                }
              },
              {
                part: 3,
                question: 'How does travel change people?',
                feedback: {
                  overallBand: 7.0,
                  summary: 'Thoughtful ideas but vocabulary could be wider.'
                }
              }
            ]
          }
        ])
      )
    );

    await page.route('**/api/v1/test-simulations/simulation-report-123', route =>
      route.fulfill(
        mockJsonSuccess({
          _id: 'simulation-report-123',
          simulationId: 'simulation-report-123',
          status: 'completed',
          overallBand: 6.5,
          createdAt: '2026-03-08T08:00:00.000Z',
          completedAt: '2026-03-08T08:14:00.000Z',
          overallFeedback: {
            summary: 'Band 6.5 with stronger performance in Part 2 than Parts 1 and 3.',
            improvements: ['Use more precise lexical items in Part 1 and Part 3.']
          },
          parts: [
            {
              part: 1,
              topicTitle: 'Hometown',
              question: 'Tell me about your hometown.',
              response: 'My hometown is Khartoum and it is busy but welcoming.',
              feedback: {
                overallBand: 6.0,
                summary: 'Clear but could be more specific.',
                improvements: ['Add one concrete example in each answer.']
              }
            },
            {
              part: 2,
              topicTitle: 'Travel',
              question: 'Describe a memorable trip you took.',
              response: 'I travelled to Istanbul with my family and explained what I learned there.',
              feedback: {
                overallBand: 6.5,
                summary: 'Good coherence across the long turn.',
                improvements: ['Use richer linking phrases in the middle of the story.']
              }
            },
            {
              part: 3,
              topicTitle: 'Travel',
              question: 'How does travel change people?',
              response: 'Travel changes people by making them more open to other perspectives.',
              feedback: {
                overallBand: 7.0,
                summary: 'Thoughtful ideas but vocabulary could be wider.',
                improvements: ['Support abstract claims with one short example.']
              }
            }
          ],
          fullEvaluation: {
            overallBand: 6.5,
            spokenSummary: 'You achieved Band 6.5 overall, with your strongest control in Part 2.',
            detailedFeedback:
              'Your test showed solid fluency and clear organization in the long turn. The shorter interview turns would be stronger with more precise vocabulary and one supporting detail per answer.',
            criteria: {
              fluencyCoherence: {
                band: 6.5,
                feedback: 'Generally clear and easy to follow.',
                strengths: ['Maintained flow in Part 2.'],
                improvements: ['Extend short Part 1 answers more naturally.']
              },
              lexicalResource: {
                band: 6.0,
                feedback: 'Meaning was clear, but word choice was repetitive.',
                strengths: ['Used understandable everyday vocabulary.'],
                improvements: ['Add more precise descriptive vocabulary.']
              },
              grammaticalRange: {
                band: 6.0,
                feedback: 'Mostly accurate simple structures.',
                strengths: ['Sentences were usually controlled.'],
                improvements: ['Use a wider range of clause patterns.']
              },
              pronunciation: {
                band: 6.5,
                feedback: 'Pronunciation was mostly clear.',
                strengths: ['Key ideas were understandable.'],
                improvements: ['Keep word stress more consistent in longer phrases.']
              }
            },
            corrections: [
              {
                original: 'I go there last year',
                corrected: 'I went there last year',
                explanation: 'Use the past tense for completed past events.',
                category: 'grammar'
              }
            ],
            suggestions: [
              {
                category: 'lexical',
                suggestion: 'Prepare topic-specific descriptive vocabulary before the next simulation.',
                priority: 'high'
              }
            ],
            partScores: {
              part1: 6,
              part2: 6.5,
              part3: 7
            }
          }
        })
      )
    );

    await page.goto('/app/speaking');
    await page.getByRole('tab', { name: 'Simulation' }).click();
    await page.getByRole('link', { name: 'Open' }).click();

    await expect(page).toHaveURL(/\/app\/speaking\/simulations\/simulation-report-123$/);
    await expect(page.getByRole('heading', { name: /Full speaking simulation report/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Why this score happened' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Stronger answer examples by part' })).toBeVisible();
  });

  test('preloaded speaking package plays the first examiner segment from package audio', async ({ page }) => {
    await installMockMediaStack(page);
    await installMockAudioContextPlayback(page);

    let synthesizeCalls = 0;

    await page.route('https://cdn.spokio.com/**', route =>
      route.fulfill({
        status: 200,
        contentType: 'audio/mpeg',
        headers: {
          'access-control-allow-origin': '*'
        },
        body: 'mock-audio'
      })
    );

    await page.route('**/api/v1/speech/synthesize', async route => {
      synthesizeCalls += 1;
      return route.fulfill(
        mockJsonSuccess({
          audioBase64: 'bW9jay1hdWRpbw==',
          mimeType: 'audio/mpeg'
        })
      );
    });

    await page.route('**/api/v1/test-simulations', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      return route.fulfill(
        mockJsonSuccess(
          {
            simulationId: 'simulation-package-audio-123',
            parts: [
              {
                part: 1,
                topicId: 'weather',
                topicTitle: 'Weather',
                question: 'What kind of weather do you enjoy most?',
                timeLimit: 60,
                tips: ['Keep answers brief']
              }
            ],
            runtime: {
              state: 'intro-examiner',
              currentPart: 0,
              currentTurnIndex: 0,
              retryCount: 0,
              retryBudgetRemaining: 1,
              introStep: 'welcome',
              seedQuestionIndex: 0,
              followUpCount: 0,
              currentSegment: {
                kind: 'cached_phrase',
                phraseId: 'welcome_intro',
                text: 'Good morning. My name is Anna. I will be your examiner today.'
              }
            },
            sessionPackage: buildSpeakingSessionPackage()
          },
          201,
          'Simulation started'
        )
      );
    });

    await page.route('**/api/v1/test-simulations/simulation-package-audio-123/runtime/advance', async route =>
      route.fulfill(
        mockJsonSuccess({
          simulationId: 'simulation-package-audio-123',
          status: 'in_progress',
          runtime: {
            state: 'intro-candidate-turn',
            currentPart: 0,
            currentTurnIndex: 0,
            retryCount: 0,
            retryBudgetRemaining: 1,
            introStep: 'welcome',
            seedQuestionIndex: 0,
            followUpCount: 0,
            currentSegment: {
              kind: 'cached_phrase',
              phraseId: 'welcome_intro',
              text: 'Good morning. My name is Anna. I will be your examiner today.'
            }
          },
          sessionPackage: buildSpeakingSessionPackage()
        })
      )
    );

    await page.goto('/app/speaking');
    await page.getByRole('tab', { name: 'Simulation' }).click();
    await page.getByRole('button', { name: 'Start Full Simulation' }).first().click();

    await expect.poll(() => page.evaluate(() => (window as typeof window & { __mockAudioContextStarts?: number }).__mockAudioContextStarts || 0)).toBeGreaterThan(0);
    await expect.poll(() => synthesizeCalls).toBe(0);
    await expect(page.getByRole('heading', { name: 'Your turn' })).toBeVisible();
  });

  test('preloaded speaking package avoids live synthesis for package-backed base prompts', async ({ page }) => {
    await installMockMediaStack(page);
    await installMockAudioContextPlayback(page);

    let synthesizeCalls = 0;
    let releaseAudioFetch: () => void = () => {};
    const audioFetchGate = new Promise<void>(resolve => {
      releaseAudioFetch = resolve;
    });

    await page.route('https://cdn.spokio.com/**', async route => {
      await audioFetchGate;
      return route.fulfill({
        status: 200,
        contentType: 'audio/mpeg',
        headers: {
          'access-control-allow-origin': '*'
        },
        body: 'mock-audio'
      });
    });

    await page.route('**/api/v1/speech/synthesize', async route => {
      synthesizeCalls += 1;
      return route.fulfill(
        mockJsonSuccess({
          audioBase64: 'bW9jay1hdWRpbw==',
          mimeType: 'audio/mpeg'
        })
      );
    });

    await page.route('**/api/v1/test-simulations', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      return route.fulfill(
        mockJsonSuccess(
          {
            simulationId: 'simulation-package-loading-123',
            parts: [
              {
                part: 1,
                topicId: 'weather',
                topicTitle: 'Weather',
                question: 'What kind of weather do you enjoy most?',
                timeLimit: 60,
                tips: ['Keep answers brief']
              }
            ],
            runtime: {
              state: 'intro-examiner',
              currentPart: 0,
              currentTurnIndex: 0,
              retryCount: 0,
              retryBudgetRemaining: 1,
              introStep: 'welcome',
              seedQuestionIndex: 0,
              followUpCount: 0,
              currentSegment: {
                kind: 'cached_phrase',
                phraseId: 'welcome_intro',
                text: 'Good morning. My name is Anna. I will be your examiner today.'
              }
            },
            sessionPackage: buildSpeakingSessionPackage()
          },
          201,
          'Simulation started'
        )
      );
    });

    await page.route('**/api/v1/test-simulations/simulation-package-loading-123/runtime/advance', async route =>
      route.fulfill(
        mockJsonSuccess({
          simulationId: 'simulation-package-loading-123',
          status: 'in_progress',
          runtime: {
            state: 'intro-candidate-turn',
            currentPart: 0,
            currentTurnIndex: 0,
            retryCount: 0,
            retryBudgetRemaining: 1,
            introStep: 'welcome',
            seedQuestionIndex: 0,
            followUpCount: 0,
            currentSegment: {
              kind: 'cached_phrase',
              phraseId: 'welcome_intro',
              text: 'Good morning. My name is Anna. I will be your examiner today.'
            }
          },
          sessionPackage: buildSpeakingSessionPackage()
        })
      )
    );

    await page.goto('/app/speaking');
    await page.getByRole('tab', { name: 'Simulation' }).click();
    await page.getByRole('button', { name: 'Start Full Simulation' }).first().click();

    await expect(page.getByRole('heading', { name: 'Examiner speaking' })).toBeVisible();
    await expect(page.getByText('Loading examiner prompt.')).toHaveCount(0);
    await expect(page.getByText('Preparing examiner audio...')).toHaveCount(0);
    await expect(page.getByText('Please listen to the examiner.')).toBeVisible();
    await expect.poll(() => synthesizeCalls).toBe(0);

    releaseAudioFetch();

    await expect.poll(() => page.evaluate(() => (window as typeof window & { __mockAudioContextStarts?: number }).__mockAudioContextStarts || 0)).toBeGreaterThan(0);
    await expect(page.getByRole('heading', { name: 'Your turn' })).toBeVisible();
  });

  test('preloads every known examiner segment in the packaged base session before later turns', async ({ page }) => {
    await installMockMediaStack(page);
    await installMockAudioContextPlayback(page);

    const requestedUrls: string[] = [];

    await page.route('https://cdn.spokio.com/**', route => {
      requestedUrls.push(route.request().url());
      return route.fulfill({
        status: 200,
        contentType: 'audio/mpeg',
        headers: {
          'access-control-allow-origin': '*'
        },
        body: 'mock-audio'
      });
    });

    await page.route('**/api/v1/test-simulations', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      return route.fulfill(
        mockJsonSuccess(
          {
            simulationId: 'simulation-full-preload-123',
            parts: [
              {
                part: 1,
                topicId: 'weather',
                topicTitle: 'Weather',
                question: 'What kind of weather do you enjoy most?',
                timeLimit: 60,
                tips: ['Keep answers brief']
              },
              {
                part: 2,
                topicId: 'trip',
                topicTitle: 'Trip',
                question: 'Describe a memorable journey you took.',
                timeLimit: 180,
                tips: ['Speak for 1-2 minutes']
              }
            ],
            runtime: {
              state: 'intro-examiner',
              currentPart: 0,
              currentTurnIndex: 0,
              retryCount: 0,
              retryBudgetRemaining: 1,
              introStep: 'welcome',
              seedQuestionIndex: 0,
              followUpCount: 0,
              currentSegment: {
                kind: 'cached_phrase',
                phraseId: 'welcome_intro',
                text: 'Good morning. My name is Anna. I will be your examiner today.'
              }
            },
            sessionPackage: buildSpeakingSessionPackage({
              extraSegments: [
                {
                  segmentId: 'part1:weather:question-1',
                  part: 1,
                  phase: 'question-seed',
                  kind: 'seed_prompt',
                  turnType: 'examiner',
                  canAutoAdvance: true,
                  promptIndex: 1,
                  text: 'How does the weather change during the year where you live?',
                  audioAssetId: 'asset-part1-q2',
                  audioUrl: 'https://cdn.spokio.com/speaking/questions/british/part1/weather-question-1.mp3',
                  cacheKey: 'question:british:part1:weather:1',
                  provider: 'openai'
                },
                {
                  segmentId: 'part1:weather:question-2',
                  part: 1,
                  phase: 'question-seed',
                  kind: 'seed_prompt',
                  turnType: 'examiner',
                  canAutoAdvance: true,
                  promptIndex: 2,
                  text: 'Does the weather affect your mood?',
                  audioAssetId: 'asset-part1-q3',
                  audioUrl: 'https://cdn.spokio.com/speaking/questions/british/part1/weather-question-2.mp3',
                  cacheKey: 'question:british:part1:weather:2',
                  provider: 'openai'
                },
                {
                  segmentId: 'fixed:part2_intro',
                  part: 2,
                  phase: 'transition',
                  kind: 'transition',
                  turnType: 'examiner',
                  canAutoAdvance: true,
                  phraseId: 'part2_intro',
                  text: 'Now I am going to give you a topic and I would like you to talk about it for one to two minutes.',
                  audioAssetId: 'asset-part2-intro',
                  audioUrl: 'https://cdn.spokio.com/speaking/fixed/british/part2_intro.mp3',
                  cacheKey: 'fixed:british:part2_intro',
                  provider: 'openai'
                }
              ]
            })
          },
          201,
          'Simulation started'
        )
      );
    });

    await page.route('**/api/v1/test-simulations/simulation-full-preload-123/runtime/advance', async route =>
      route.fulfill(
        mockJsonSuccess({
          simulationId: 'simulation-full-preload-123',
          status: 'in_progress',
          runtime: {
            state: 'intro-candidate-turn',
            currentPart: 0,
            currentTurnIndex: 0,
            retryCount: 0,
            retryBudgetRemaining: 1,
            introStep: 'welcome',
            seedQuestionIndex: 0,
            followUpCount: 0,
            currentSegment: {
              kind: 'cached_phrase',
              phraseId: 'welcome_intro',
              text: 'Good morning. My name is Anna. I will be your examiner today.'
            }
          },
          sessionPackage: buildSpeakingSessionPackage({
            extraSegments: [
              {
                segmentId: 'part1:weather:question-1',
                part: 1,
                phase: 'question-seed',
                kind: 'seed_prompt',
                turnType: 'examiner',
                canAutoAdvance: true,
                promptIndex: 1,
                text: 'How does the weather change during the year where you live?',
                audioAssetId: 'asset-part1-q2',
                audioUrl: 'https://cdn.spokio.com/speaking/questions/british/part1/weather-question-1.mp3',
                cacheKey: 'question:british:part1:weather:1',
                provider: 'openai'
              },
              {
                segmentId: 'part1:weather:question-2',
                part: 1,
                phase: 'question-seed',
                kind: 'seed_prompt',
                turnType: 'examiner',
                canAutoAdvance: true,
                promptIndex: 2,
                text: 'Does the weather affect your mood?',
                audioAssetId: 'asset-part1-q3',
                audioUrl: 'https://cdn.spokio.com/speaking/questions/british/part1/weather-question-2.mp3',
                cacheKey: 'question:british:part1:weather:2',
                provider: 'openai'
              },
              {
                segmentId: 'fixed:part2_intro',
                part: 2,
                phase: 'transition',
                kind: 'transition',
                turnType: 'examiner',
                canAutoAdvance: true,
                phraseId: 'part2_intro',
                text: 'Now I am going to give you a topic and I would like you to talk about it for one to two minutes.',
                audioAssetId: 'asset-part2-intro',
                audioUrl: 'https://cdn.spokio.com/speaking/fixed/british/part2_intro.mp3',
                cacheKey: 'fixed:british:part2_intro',
                provider: 'openai'
              }
            ]
          })
        })
      )
    );

    await page.goto('/app/speaking');
    await page.getByRole('tab', { name: 'Simulation' }).click();
    await page.getByRole('button', { name: 'Start Full Simulation' }).first().click();

    await expect.poll(() =>
      requestedUrls.filter(url => url.includes('/speaking/fixed/british/part2_intro.mp3')).length
    ).toBeGreaterThan(0);
  });

  test('package synthesis fallback keeps the selected examiner voice profile', async ({ page }) => {
    await installMockMediaStack(page);
    await installMockAudioContextPlayback(page);

    let synthesizedVoiceId: string | undefined;

    await page.route('https://cdn.spokio.com/**', route =>
      route.fulfill({
        status: 404,
        body: 'missing'
      })
    );

    await page.route('**/api/v1/speech/synthesize', async route => {
      synthesizedVoiceId = route.request().postDataJSON()?.voiceId;
      return route.fulfill(
        mockJsonSuccess({
          audioBase64: 'bW9jay1hdWRpbw==',
          mimeType: 'audio/mpeg'
        })
      );
    });

    await page.route('**/api/v1/test-simulations', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      return route.fulfill(
        mockJsonSuccess(
          {
            simulationId: 'simulation-package-fallback-voice',
            parts: [
              {
                part: 1,
                topicId: 'weather',
                topicTitle: 'Weather',
                question: 'What kind of weather do you enjoy most?',
                timeLimit: 60,
                tips: ['Keep answers brief']
              }
            ],
            runtime: {
              state: 'intro-examiner',
              currentPart: 0,
              currentTurnIndex: 0,
              retryCount: 0,
              retryBudgetRemaining: 1,
              introStep: 'welcome',
              seedQuestionIndex: 0,
              followUpCount: 0,
              currentSegment: {
                kind: 'cached_phrase',
                phraseId: 'welcome_intro',
                text: 'Good morning. My name is Anna. I will be your examiner today.'
              }
            },
            sessionPackage: buildSpeakingSessionPackage({
              examinerProfileId: 'australian',
              examinerProfileLabel: 'Australian Examiner',
              examinerAccent: 'Australian',
              examinerVoiceId: 'echo'
            })
          },
          201,
          'Simulation started'
        )
      );
    });

    await page.route('**/api/v1/test-simulations/simulation-package-fallback-voice/runtime/advance', async route =>
      route.fulfill(
        mockJsonSuccess({
          simulationId: 'simulation-package-fallback-voice',
          status: 'in_progress',
          runtime: {
            state: 'intro-candidate-turn',
            currentPart: 0,
            currentTurnIndex: 0,
            retryCount: 0,
            retryBudgetRemaining: 1,
            introStep: 'welcome',
            seedQuestionIndex: 0,
            followUpCount: 0,
            currentSegment: {
              kind: 'cached_phrase',
              phraseId: 'welcome_intro',
              text: 'Good morning. My name is Anna. I will be your examiner today.'
            }
          },
          sessionPackage: buildSpeakingSessionPackage({
            examinerProfileId: 'australian',
            examinerProfileLabel: 'Australian Examiner',
            examinerAccent: 'Australian',
            examinerVoiceId: 'echo'
          })
        })
      )
    );

    await page.goto('/app/speaking');
    await page.getByRole('tab', { name: 'Simulation' }).click();
    await page.getByRole('button', { name: 'Start Full Simulation' }).first().click();

    await expect.poll(() => synthesizedVoiceId).toBe('echo');
    await expect(page.getByRole('heading', { name: 'Your turn' })).toBeVisible();
  });

  test('hydrates missing simulation runtime after start so the examiner flow can continue', async ({ page }) => {
    await installMockMediaStack(page);
    await installMockAudioContextPlayback(page);

    await page.route('**/api/v1/test-simulations', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      return route.fulfill(
        mockJsonSuccess(
          {
            simulationId: 'simulation-runtime-recovery-123',
            parts: [
              {
                part: 1,
                topicId: 'weather',
                topicTitle: 'Weather',
                question: 'Would you like to attend weather in the future?\nWhat do you do when the weather changes?',
                timeLimit: 60,
                tips: ['Keep answers brief', 'Give specific examples']
              },
              {
                part: 2,
                topicId: 'app',
                topicTitle: 'App',
                question: 'Describe a challenging app.\n\nYou should say:\n• what it does\n• why it is challenging',
                timeLimit: 180,
                tips: ['You have 1 minute to prepare', 'Speak for 1-2 minutes']
              },
              {
                part: 3,
                topicId: 'technology',
                topicTitle: 'Technology',
                question: 'How do apps change everyday life?\nShould all services depend on apps?',
                timeLimit: 120,
                tips: ['Explain your reasons']
              }
            ]
          },
          201,
          'Simulation started'
        )
      );
    });

    await page.route('**/api/v1/test-simulations/simulation-runtime-recovery-123/runtime', async route =>
      route.fulfill(
        mockJsonSuccess({
          simulationId: 'simulation-runtime-recovery-123',
          status: 'in_progress',
          runtime: {
            state: 'intro-examiner',
            currentPart: 0,
            currentTurnIndex: 0,
            retryCount: 0,
            retryBudgetRemaining: 1,
            introStep: 'welcome',
            seedQuestionIndex: 0,
            followUpCount: 0,
            currentSegment: {
              kind: 'cached_phrase',
              phraseId: 'welcome_intro',
              text: 'Good morning. My name is Anna. I will be your examiner today.'
            }
          }
        })
      )
    );

    await page.goto('/app/speaking');
    await page.getByRole('tab', { name: 'Simulation' }).click();
    await page.getByRole('button', { name: 'Start Full Simulation' }).first().click();

    await expect(page.getByText('Good morning. My name is Anna. I will be your examiner today.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue after prompt' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Your turn' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Recording' })).toBeEnabled();
  });

  test('runs full simulation as examiner audio plus learner turns', async ({ page }) => {
    await installMockMediaStack(page);
    await installMockAudioContextPlayback(page);

    await page.route('**/api/v1/speech/synthesize', route =>
      route.fulfill(
        mockJsonSuccess({
          audioBase64: 'bW9jay1hdWRpbw==',
          mimeType: 'audio/mpeg'
        })
      )
    );

    await page.route('**/api/v1/test-simulations', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      return route.fulfill(
        mockJsonSuccess(
          {
            simulationId: 'simulation-runtime-123',
            parts: [
              {
                part: 1,
                topicId: 'hobbies',
                topicTitle: 'Hobbies',
                question:
                  'What hobbies do you have?\nHow often do you spend time on your hobbies?\nDo you prefer to do hobbies alone or with friends?',
                timeLimit: 60,
                tips: ['Keep answers brief', 'Add one real example']
              },
              {
                part: 2,
                topicId: 'memorable-trip',
                topicTitle: 'Memorable trip',
                question: 'Describe a memorable journey you have taken.\n\nYou should say:\n• where you went\n• who you went with',
                timeLimit: 180,
                tips: ['You have 1 minute to prepare', 'Speak for 1-2 minutes']
              },
              {
                part: 3,
                topicId: 'travel',
                topicTitle: 'Travel',
                question: 'How does travel change people?\nWhy do some people avoid travelling?',
                timeLimit: 120,
                tips: ['Explain your reasons', 'Compare different viewpoints']
              }
            ],
            runtime: {
              state: 'intro-examiner',
              currentPart: 0,
              currentTurnIndex: 0,
              retryCount: 0,
              retryBudgetRemaining: 1,
              introStep: 'welcome',
              seedQuestionIndex: 0,
              followUpCount: 0,
              currentSegment: {
                kind: 'cached_phrase',
                phraseId: 'welcome_intro',
                text: 'Good morning. My name is Anna. I will be your examiner today.'
              }
            }
          },
          201,
          'Simulation started'
        )
      );
    });

    await page.route('**/api/v1/test-simulations/simulation-runtime-123/runtime/advance', async route =>
      route.fulfill(
        mockJsonSuccess({
          simulationId: 'simulation-runtime-123',
          status: 'in_progress',
          runtime: {
            state: 'intro-candidate-turn',
            currentPart: 0,
            currentTurnIndex: 0,
            retryCount: 0,
            retryBudgetRemaining: 1,
            introStep: 'welcome',
            seedQuestionIndex: 0,
            followUpCount: 0,
            currentSegment: {
              kind: 'cached_phrase',
              phraseId: 'welcome_intro',
              text: 'Good morning. My name is Anna. I will be your examiner today.'
            }
          }
        })
      )
    );

    await page.goto('/app/speaking');
    await page.getByRole('tab', { name: 'Simulation' }).click();
    await page.getByRole('button', { name: 'Start Full Simulation' }).first().click();

    await expect.poll(() => page.evaluate(() => (window as typeof window & { __mockGetUserMediaCalls?: number }).__mockGetUserMediaCalls || 0)).toBe(1);
    await expect.poll(() => page.evaluate(() => (window as typeof window & { __mockAudioContextStarts?: number }).__mockAudioContextStarts || 0)).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: 'Continue after prompt' })).toHaveCount(0);
    await expect(page.getByPlaceholder('Write or paste your response for this speaking part')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Your turn' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Recording' })).toBeEnabled();
  });

  test('unlocks the learner turn even if the browser never fires audio ended', async ({ page }) => {
    await installMockMediaStack(page);
    await installMockAudioContextPlayback(page, { fireEnded: false });

    await page.route('**/api/v1/speech/synthesize', route =>
      route.fulfill(
        mockJsonSuccess({
          audioBase64: 'bW9jay1hdWRpbw==',
          mimeType: 'audio/mpeg'
        })
      )
    );

    await page.route('**/api/v1/test-simulations', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      return route.fulfill(
        mockJsonSuccess(
          {
            simulationId: 'simulation-runtime-audio-fallback-123',
            parts: [
              {
                part: 1,
                topicId: 'name',
                topicTitle: 'Check-in',
                question: 'Can you tell me your full name please?',
                timeLimit: 30,
                tips: ['Answer clearly']
              }
            ],
            runtime: {
              state: 'intro-examiner',
              currentPart: 0,
              currentTurnIndex: 0,
              retryCount: 0,
              retryBudgetRemaining: 1,
              introStep: 'welcome',
              seedQuestionIndex: 0,
              followUpCount: 0,
              currentSegment: {
                kind: 'cached_phrase',
                phraseId: 'welcome_intro',
                text: 'Good morning. My name is Anna. Can you tell me your full name please?'
              }
            }
          },
          201,
          'Simulation started'
        )
      );
    });

    await page.route('**/api/v1/test-simulations/simulation-runtime-audio-fallback-123/runtime/advance', async route =>
      route.fulfill(
        mockJsonSuccess({
          simulationId: 'simulation-runtime-audio-fallback-123',
          status: 'in_progress',
          runtime: {
            state: 'intro-candidate-turn',
            currentPart: 0,
            currentTurnIndex: 0,
            retryCount: 0,
            retryBudgetRemaining: 1,
            introStep: 'welcome',
            seedQuestionIndex: 0,
            followUpCount: 0,
            currentSegment: {
              kind: 'cached_phrase',
              phraseId: 'welcome_intro',
              text: 'Good morning. My name is Anna. Can you tell me your full name please?'
            }
          }
        })
      )
    );

    await page.goto('/app/speaking');
    await page.getByRole('tab', { name: 'Simulation' }).click();
    await page.getByRole('button', { name: 'Start Full Simulation' }).first().click();

    await expect(page.getByRole('button', { name: 'Continue after prompt' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Your turn' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Recording' })).toBeEnabled();
  });

  test('auto-advances from part 1 intro into the first examiner question', async ({ page }) => {
    await installMockMediaStack(page);
    await installMockAudioContextPlayback(page);

    let advanceCalls = 0;

    await page.route('**/api/v1/test-simulations', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      return route.fulfill(
        mockJsonSuccess(
          {
            simulationId: 'simulation-part1-handoff-123',
            parts: [
              {
                part: 1,
                topicId: 'weather',
                topicTitle: 'Weather',
                question: 'What kind of weather do you enjoy most?',
                timeLimit: 60,
                tips: ['Keep answers brief']
              }
            ],
            runtime: {
              state: 'intro-examiner',
              currentPart: 0,
              currentTurnIndex: 0,
              retryCount: 0,
              retryBudgetRemaining: 1,
              introStep: 'part1_begin',
              seedQuestionIndex: 0,
              followUpCount: 0,
              currentSegment: {
                kind: 'cached_phrase',
                phraseId: 'part1_begin',
                text: "Thank you. Let's begin with Part 1 of the test."
              }
            }
          },
          201,
          'Simulation started'
        )
      );
    });

    await page.route('**/api/v1/test-simulations/simulation-part1-handoff-123/runtime/advance', async route => {
      advanceCalls += 1;

      if (advanceCalls === 1) {
        return route.fulfill(
          mockJsonSuccess({
            simulationId: 'simulation-part1-handoff-123',
            status: 'in_progress',
            runtime: {
              state: 'part1-examiner',
              currentPart: 1,
              currentTurnIndex: 0,
              retryCount: 0,
              retryBudgetRemaining: 1,
              seedQuestionIndex: 0,
              followUpCount: 0,
              currentSegment: {
                kind: 'dynamic_prompt',
                text: 'What kind of weather do you enjoy most?'
              }
            }
          })
        );
      }

      return route.fulfill(
        mockJsonSuccess({
          simulationId: 'simulation-part1-handoff-123',
          status: 'in_progress',
          runtime: {
            state: 'part1-candidate-turn',
            currentPart: 1,
            currentTurnIndex: 0,
            retryCount: 0,
            retryBudgetRemaining: 1,
            seedQuestionIndex: 0,
            followUpCount: 0,
            currentSegment: {
              kind: 'dynamic_prompt',
              text: 'What kind of weather do you enjoy most?'
            }
          }
        })
      );
    });

    await page.goto('/app/speaking');
    await page.getByRole('tab', { name: 'Simulation' }).click();
    await page.getByRole('button', { name: 'Start Full Simulation' }).first().click();

    await expect(page.getByText('What kind of weather do you enjoy most?')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your turn' })).toBeVisible();
    await expect.poll(() => advanceCalls).toBeGreaterThanOrEqual(2);
  });

  test('waits for examiner audio synthesis before switching into the candidate turn', async ({ page }) => {
    await installMockMediaStack(page);
    await installMockAudioContextPlayback(page);

    let releaseSynthesis: () => void = () => {};
    const synthesisGate = new Promise<void>(resolve => {
      releaseSynthesis = resolve;
    });

    await page.route('**/api/v1/test-simulations', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      return route.fulfill(
        mockJsonSuccess(
          {
            simulationId: 'simulation-delayed-synthesis-123',
            parts: [
              {
                part: 1,
                topicId: 'weather',
                topicTitle: 'Weather',
                question: 'What kind of weather do you enjoy most?',
                timeLimit: 60,
                tips: ['Keep answers brief']
              }
            ],
            runtime: {
              state: 'part1-examiner',
              currentPart: 1,
              currentTurnIndex: 0,
              retryCount: 0,
              retryBudgetRemaining: 1,
              seedQuestionIndex: 0,
              followUpCount: 0,
              currentSegment: {
                kind: 'dynamic_prompt',
                text: 'What kind of weather do you enjoy most?'
              }
            }
          },
          201,
          'Simulation started'
        )
      );
    });

    await page.route('**/api/v1/speech/synthesize', async route => {
      await synthesisGate;
      return route.fulfill(
        mockJsonSuccess({
          audioBase64: 'bW9jay1hdWRpbw==',
          mimeType: 'audio/mpeg'
        })
      );
    });

    await page.route('**/api/v1/test-simulations/simulation-delayed-synthesis-123/runtime/advance', async route =>
      route.fulfill(
        mockJsonSuccess({
          simulationId: 'simulation-delayed-synthesis-123',
          status: 'in_progress',
          runtime: {
            state: 'part1-candidate-turn',
            currentPart: 1,
            currentTurnIndex: 0,
            retryCount: 0,
            retryBudgetRemaining: 1,
            seedQuestionIndex: 0,
            followUpCount: 0,
            currentSegment: {
              kind: 'dynamic_prompt',
              text: 'What kind of weather do you enjoy most?'
            }
          }
        })
      )
    );

    await page.goto('/app/speaking');
    await page.getByRole('tab', { name: 'Simulation' }).click();
    await page.getByRole('button', { name: 'Start Full Simulation' }).first().click();

    await expect(page.getByRole('heading', { name: 'Examiner speaking' })).toBeVisible();
    await expect(page.getByText('Please listen to the examiner.')).toBeVisible();
    await expect(page.getByText('Preparing examiner audio...')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Your turn' })).toHaveCount(0);

    releaseSynthesis();

    await expect(page.getByRole('heading', { name: 'Your turn' })).toBeVisible();
  });

  test('auto-starts and auto-submits part 1 recording after silence', async ({ page }) => {
    await installMockMediaStack(page);
    await installMockAudioContextPlayback(page, { analyserSpeechReads: 4 });
    await page.addInitScript(() => {
      (window as typeof window & { __spokioSimulationSilenceMs?: number }).__spokioSimulationSilenceMs = 250;
    });

    let answerCalls = 0;
    let submittedTranscript = '';

    await page.route('**/api/v1/test-simulations', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      return route.fulfill(
        mockJsonSuccess(
          {
            simulationId: 'simulation-silence-123',
            parts: [
              {
                part: 1,
                topicId: 'weather',
                topicTitle: 'Weather',
                question: 'What kind of weather do you enjoy most?',
                timeLimit: 60,
                tips: ['Keep answers brief']
              }
            ],
            runtime: {
              state: 'part1-candidate-turn',
              currentPart: 1,
              currentTurnIndex: 0,
              retryCount: 0,
              retryBudgetRemaining: 1,
              seedQuestionIndex: 0,
              followUpCount: 0,
              currentSegment: {
                kind: 'dynamic_prompt',
                text: 'What kind of weather do you enjoy most?'
              }
            }
          },
          201,
          'Simulation started'
        )
      );
    });

    await page.route('**/api/v1/speech/transcribe', async route =>
      route.fulfill(
        mockJsonSuccess({
          text: 'I enjoy cool weather because it is easier to walk outside.',
          duration: 8
        })
      )
    );

    await page.route('**/api/v1/test-simulations/simulation-silence-123/runtime/answer', async route => {
      answerCalls += 1;
      submittedTranscript = JSON.parse(route.request().postData() || '{}').transcript || '';
      return route.fulfill(
        mockJsonSuccess({
          simulationId: 'simulation-silence-123',
          status: 'in_progress',
          runtime: {
            state: 'part1-examiner',
            currentPart: 1,
            currentTurnIndex: 0,
            retryCount: 0,
            retryBudgetRemaining: 1,
            seedQuestionIndex: 0,
            followUpCount: 1,
            currentSegment: {
              kind: 'dynamic_prompt',
              text: 'Why do you like that kind of weather?'
            },
            turnHistory: [
              {
                part: 1,
                prompt: 'What kind of weather do you enjoy most?',
                transcript: 'I enjoy cool weather because it is easier to walk outside.',
                durationSeconds: 8
              }
            ]
          }
        })
      );
    });

    await page.route('**/api/v1/test-simulations/simulation-silence-123/runtime/advance', async route =>
      route.fulfill(
        mockJsonSuccess({
          simulationId: 'simulation-silence-123',
          status: 'in_progress',
          runtime: {
            state: 'part1-candidate-turn',
            currentPart: 1,
            currentTurnIndex: 0,
            retryCount: 0,
            retryBudgetRemaining: 1,
            seedQuestionIndex: 0,
            followUpCount: 1,
            currentSegment: {
              kind: 'dynamic_prompt',
              text: 'Why do you like that kind of weather?'
            },
            turnHistory: [
              {
                part: 1,
                prompt: 'What kind of weather do you enjoy most?',
                transcript: 'I enjoy cool weather because it is easier to walk outside.',
                durationSeconds: 8
              }
            ]
          }
        })
      )
    );

    await page.goto('/app/speaking');
    await page.getByRole('tab', { name: 'Simulation' }).click();
    await page.getByRole('button', { name: 'Start Full Simulation' }).first().click();

    await expect(page.getByText('Recording in progress.')).toBeVisible();
    await expect(
      page.getByText('Recording starts automatically and submits after a short silence. Use Stop + Submit only if you want to finish early.')
    ).toBeVisible();
    await expect(page.getByText('Why do you like that kind of weather?')).toBeVisible();
    await expect.poll(() => answerCalls).toBe(1);
    await expect.poll(() => submittedTranscript).toBe('I enjoy cool weather because it is easier to walk outside.');
  });

  test('auto-starts part 2 recording after the examiner tells the candidate to begin', async ({ page }) => {
    await installMockMediaStack(page);
    await installMockAudioContextPlayback(page, { analyserSpeechReads: 4 });

    await page.route('**/api/v1/test-simulations', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      return route.fulfill(
        mockJsonSuccess(
          {
            simulationId: 'simulation-part2-manual-123',
            parts: [
              {
                part: 2,
                topicId: 'trip',
                topicTitle: 'Trip',
                question: 'Describe a memorable journey you took.',
                timeLimit: 180,
                tips: ['Speak for 1-2 minutes']
              }
            ],
            runtime: {
              state: 'part2-examiner-launch',
              currentPart: 2,
              currentTurnIndex: 0,
              retryCount: 0,
              retryBudgetRemaining: 1,
              seedQuestionIndex: 0,
              followUpCount: 0,
              currentSegment: {
                kind: 'cached_phrase',
                phraseId: 'part2_begin_speaking',
                text: 'Please begin speaking now.'
              }
            }
          },
          201,
          'Simulation started'
        )
      );
    });

    await page.route('**/api/v1/test-simulations/simulation-part2-manual-123/runtime/advance', async route =>
      route.fulfill(
        mockJsonSuccess({
          simulationId: 'simulation-part2-manual-123',
          status: 'in_progress',
          runtime: {
            state: 'part2-candidate-turn',
            currentPart: 2,
            currentTurnIndex: 0,
            retryCount: 0,
            retryBudgetRemaining: 1,
            seedQuestionIndex: 0,
            followUpCount: 0,
            currentSegment: {
              kind: 'dynamic_prompt',
              text: 'Describe a memorable journey you took.'
            }
          }
        })
      )
    );

    await page.goto('/app/speaking');
    await page.getByRole('tab', { name: 'Simulation' }).click();
    await page.getByRole('button', { name: 'Start Full Simulation' }).first().click();

    await expect(page.getByText('Please begin speaking now.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your turn' })).toBeVisible();
    await expect(page.getByText('Recording in progress.')).toBeVisible();
    await expect(
      page.getByText('Recording starts automatically after the examiner prompt. Use Stop + Submit when you are ready to finish Part 2.')
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Stop + Submit' })).toBeEnabled();
  });

  test('shows a retryable pause when a simulation step fails', async ({ page }) => {
    await installMockMediaStack(page);

    await page.route('**/api/v1/test-simulations', async route => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }

      return route.fulfill(
        mockJsonSuccess(
          {
            simulationId: 'simulation-runtime-123',
            parts: [
              {
                part: 1,
                topicId: 'hobbies',
                topicTitle: 'Hobbies',
                question: 'What hobbies do you have?',
                timeLimit: 60,
                tips: ['Keep answers brief']
              }
            ],
            runtime: {
              state: 'paused-retryable',
              currentPart: 1,
              currentTurnIndex: 0,
              retryCount: 1,
              retryBudgetRemaining: 0,
              previousState: 'part1-examiner',
              lastError: 'Speech synthesis failed for the current examiner prompt.',
              failedStep: 'speech_synthesis',
              currentSegment: {
                kind: 'dynamic_prompt',
                text: 'What hobbies do you have?'
              }
            }
          },
          201,
          'Simulation started'
        )
      );
    });

    await page.goto('/app/speaking');
    await page.getByRole('tab', { name: 'Simulation' }).click();
    await page.getByRole('button', { name: 'Start Full Simulation' }).first().click();

    await expect(page.getByRole('heading', { name: 'Simulation paused' })).toBeVisible();
    await expect(page.getByText('Speech synthesis failed for the current examiner prompt.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry step' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restart simulation' })).toBeVisible();
  });

  test('shows explicit error when microphone permission is denied', async ({ page }) => {
    await installMockMediaStack(page, {
      getUserMediaErrorName: 'NotAllowedError',
      getUserMediaErrorMessage: 'Permission denied'
    });

    await page.goto('/app/speaking');

    await page.getByRole('button', { name: 'Start Practice' }).first().click();
    await page.getByRole('button', { name: 'Start Recording' }).click();

    await expect(
      page.getByText('Microphone permission denied. You can continue with manual transcript input.')
    ).toBeVisible();
  });

  test('shows explicit error when no microphone device is available', async ({ page }) => {
    await installMockMediaStack(page, {
      devices: [],
      getUserMediaErrorName: 'NotFoundError',
      getUserMediaErrorMessage: 'No input devices'
    });

    await page.goto('/app/speaking');
    await page.getByRole('button', { name: 'Start Practice' }).first().click();
    await page.getByRole('button', { name: 'Start Recording' }).click();

    await expect(
      page.getByText('No microphone device found. Connect a microphone or use manual transcript input.')
    ).toBeVisible();
  });

  test('handles recorder runtime failure and keeps manual transcript fallback available', async ({ page }) => {
    await installMockMediaStack(page, {
      recorderStartErrorName: 'RecorderError',
      recorderStartErrorMessage: 'Recorder crashed while starting'
    });

    await page.goto('/app/speaking');
    await page.getByRole('button', { name: 'Start Practice' }).first().click();
    await page.getByRole('button', { name: 'Start Recording' }).click();

    await expect(page.getByText('Recorder crashed while starting')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit Manual Transcript' })).toBeDisabled();
  });

  test('surfaces upload timeout and allows manual transcript recovery', async ({ page }) => {
    await installMockMediaStack(page);

    await page.route('**/api/v1/practice/sessions/*/audio', route =>
      route.fulfill({
        status: 504,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Upload timed out'
        })
      })
    );

    await page.goto('/app/speaking');
    await page.getByRole('button', { name: 'Start Practice' }).first().click();
    await page.getByRole('button', { name: 'Start Recording' }).click();
    await page.getByRole('button', { name: 'Stop + Upload' }).click();

    await expect(page.getByText('Upload timed out')).toBeVisible();

    await page
      .getByPlaceholder('Type your answer if microphone permission is denied or device fails')
      .fill('I travelled with my family and learned a lot from the experience.');
    await page.getByRole('button', { name: 'Submit Manual Transcript' }).click();
    await expect(page.getByRole('heading', { name: 'Review your response' })).toBeVisible();
  });

  test('handles transcription failure with fallback transcript path', async ({ page }) => {
    await installMockMediaStack(page);

    await page.route('**/api/v1/practice/sessions/*/audio', route =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Transcription failed. Please use manual transcript input.'
        })
      })
    );

    await page.goto('/app/speaking');
    await page.getByRole('button', { name: 'Start Practice' }).first().click();
    await page.getByRole('button', { name: 'Start Recording' }).click();
    await page.getByRole('button', { name: 'Stop + Upload' }).click();

    await expect(page.getByText('Transcription failed. Please use manual transcript input.')).toBeVisible();

    await page
      .getByPlaceholder('Type your answer if microphone permission is denied or device fails')
      .fill('My answer is provided manually after transcription fallback.');
    await page.getByRole('button', { name: 'Submit Manual Transcript' }).click();

    await expect(page.getByRole('heading', { name: 'Review your response' })).toBeVisible();
  });
});
