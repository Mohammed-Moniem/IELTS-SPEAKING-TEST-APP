const mockEnv = {
  push: {
    enabled: true,
    campaignSchedulerEnabled: true,
    campaignSweepIntervalMs: 60000
  },
  errors: {
    errorPrefix: 'SERVICE',
    default: {
      errorCode: 'GLOBAL.UNMAPPED-ERROR',
      errorMessage: 'Something went wrong',
      errorDescription: 'Error is not mapped'
    }
  }
};

const mockNotificationService = {
  findUsersNeedingInactivityReminder: jest.fn(),
  notifyInactivity: jest.fn()
};

const mockCampaignService = {
  processDueCampaigns: jest.fn()
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn()
};

jest.mock('@env', () => ({
  env: mockEnv
}));

jest.mock('../../../../src/lib/logger', () => ({
  Logger: jest.fn().mockImplementation(() => mockLogger)
}));

import Container from 'typedi';
import { initializeNotificationScheduler } from '../../../../src/loaders/NotificationScheduler';

describe('NotificationScheduler', () => {
  let setIntervalSpy: jest.SpyInstance;
  let containerGetSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.push.enabled = true;
    mockEnv.push.campaignSchedulerEnabled = true;
    mockEnv.push.campaignSweepIntervalMs = 60000;
    mockNotificationService.findUsersNeedingInactivityReminder.mockResolvedValue([]);
    mockNotificationService.notifyInactivity.mockResolvedValue(undefined);
    mockCampaignService.processDueCampaigns.mockResolvedValue({ processed: 0, scanned: 0 });

    let callCount = 0;
    containerGetSpy = jest.spyOn(Container, 'get').mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) return mockNotificationService;
      if (callCount === 2) return mockCampaignService;
      return null;
    });

    setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation((() => {
      return {
        unref: jest.fn()
      } as any;
    }) as any);
  });

  afterEach(() => {
    containerGetSpy.mockRestore();
    setIntervalSpy.mockRestore();
  });

  it('does not start when push notifications are disabled', async () => {
    mockEnv.push.enabled = false;

    initializeNotificationScheduler();
    await Promise.resolve();

    expect(containerGetSpy).not.toHaveBeenCalled();
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('runs startup sweeps and schedules inactivity + campaign intervals when enabled', async () => {
    mockNotificationService.findUsersNeedingInactivityReminder.mockResolvedValue([
      { userId: '507f1f77bcf86cd799439011', daysInactive: 3 }
    ]);
    mockCampaignService.processDueCampaigns.mockResolvedValue({ processed: 2, scanned: 2 });

    initializeNotificationScheduler();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockNotificationService.findUsersNeedingInactivityReminder).toHaveBeenCalledTimes(1);
    expect(mockNotificationService.notifyInactivity).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 3);
    expect(mockCampaignService.processDueCampaigns).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledTimes(2);
    expect(setIntervalSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 60 * 60 * 1000);
    expect(setIntervalSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 60000);
  });

  it('skips campaign sweep scheduling when campaign scheduler is disabled', async () => {
    mockEnv.push.campaignSchedulerEnabled = false;

    initializeNotificationScheduler();
    await Promise.resolve();

    expect(mockNotificationService.findUsersNeedingInactivityReminder).toHaveBeenCalledTimes(1);
    expect(mockCampaignService.processDueCampaigns).not.toHaveBeenCalled();
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Push campaign scheduler disabled by env; scheduled campaigns require manual send/fallback'
    );
  });
});
