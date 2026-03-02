import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { NotificationSettingsScreen } from "./NotificationSettingsScreen";

const mockColors: any = new Proxy(
  {},
  {
    get: () => "#123456",
  }
);

const mockGetPreferences = jest.fn();
const mockUpdatePreferences = jest.fn();
const mockExtractErrorMessage = jest.fn((_error?: unknown) => "Unable to save settings");

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

jest.mock("../../api/services", () => ({
  notificationsApi: {
    getPreferences: () => mockGetPreferences(),
    updatePreferences: (payload: any) => mockUpdatePreferences(payload),
  },
}));

jest.mock("../../context", () => ({
  useTheme: () => ({ colors: mockColors }),
}));

jest.mock("../../hooks", () => ({
  useThemedStyles: (factory: any) => factory(mockColors),
}));

jest.mock("../../components/Card", () => ({
  Card: ({ children }: any) => <>{children}</>,
}));

jest.mock("../../components/ScreenContainer", () => ({
  ScreenContainer: ({ children }: any) => <>{children}</>,
}));

jest.mock("../../components/SectionHeading", () => ({
  SectionHeading: ({ children }: any) => <>{children}</>,
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("../../utils/errors", () => ({
  extractErrorMessage: (error: any) => mockExtractErrorMessage(error),
}));

jest.mock("../../services/notificationService", () => ({
  __esModule: true,
  default: {
    getPermissionStatus: jest.fn(),
    requestPermissions: jest.fn(),
    initialize: jest.fn(),
    scheduleDailyReminder: jest.fn(),
    scheduleNotification: jest.fn(),
  },
}));

const AsyncStorage = require("@react-native-async-storage/async-storage").default;
const notificationService = require("../../services/notificationService").default;

const baseSettings = {
  dailyReminderEnabled: true,
  dailyReminderHour: 19,
  dailyReminderMinute: 0,
  achievementsEnabled: true,
  streakRemindersEnabled: true,
  inactivityRemindersEnabled: true,
  feedbackNotificationsEnabled: true,
  directMessagesEnabled: true,
  groupMessagesEnabled: true,
  friendRequestsEnabled: true,
  friendAcceptancesEnabled: true,
  systemAnnouncementsEnabled: true,
  offersEnabled: true,
  partnerOffersEnabled: true,
};

describe("NotificationSettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPreferences.mockResolvedValue(baseSettings);
    mockUpdatePreferences.mockImplementation(async (payload: any) => payload);
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(undefined);
    notificationService.getPermissionStatus.mockResolvedValue("granted");
    notificationService.requestPermissions.mockResolvedValue(true);
    notificationService.initialize.mockResolvedValue(undefined);
    notificationService.scheduleDailyReminder.mockResolvedValue(undefined);
    notificationService.scheduleNotification.mockResolvedValue(undefined);
  });

  it("loads settings and renders new partner/friend toggles", async () => {
    const { findByTestId } = render(<NotificationSettingsScreen />);

    const friendRequestsToggle = await findByTestId("toggle-friend-requests");
    const friendAcceptancesToggle = await findByTestId("toggle-friend-acceptances");
    const partnerOffersToggle = await findByTestId("toggle-partner-offers");

    expect(friendRequestsToggle.props.value).toBe(true);
    expect(friendAcceptancesToggle.props.value).toBe(true);
    expect(partnerOffersToggle.props.value).toBe(true);
  });

  it("persists friend/partner toggle updates with new fields", async () => {
    const { findByTestId } = render(<NotificationSettingsScreen />);

    const friendRequestsToggle = await findByTestId("toggle-friend-requests");
    fireEvent(friendRequestsToggle, "valueChange", false);

    await waitFor(() =>
      expect(mockUpdatePreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          friendRequestsEnabled: false,
          friendAcceptancesEnabled: true,
          partnerOffersEnabled: true,
        })
      )
    );

    const partnerOffersToggle = await findByTestId("toggle-partner-offers");
    fireEvent(partnerOffersToggle, "valueChange", false);

    await waitFor(() =>
      expect(mockUpdatePreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          friendRequestsEnabled: false,
          partnerOffersEnabled: false,
        })
      )
    );
  });
});
