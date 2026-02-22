import AsyncStorage from "@react-native-async-storage/async-storage";

const FREE_TRIAL_USED_KEY = "has_used_free_trial";

export type FreeTrialStatus = "unused" | "active" | "completed";

export type FreeTrialState = {
  status: FreeTrialStatus;
  consumedAt?: string;
  completedAt?: string;
};

const DEFAULT_FREE_TRIAL_STATE: FreeTrialState = {
  status: "unused",
};

const parseState = (value: string | null): FreeTrialState => {
  if (!value) {
    return DEFAULT_FREE_TRIAL_STATE;
  }

  // Backward compatibility for legacy boolean storage.
  if (value === "true") {
    return {
      status: "completed",
      consumedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
  }

  if (value === "false") {
    return DEFAULT_FREE_TRIAL_STATE;
  }

  try {
    const parsed = JSON.parse(value) as Partial<FreeTrialState>;
    if (
      parsed?.status === "unused" ||
      parsed?.status === "active" ||
      parsed?.status === "completed"
    ) {
      return {
        status: parsed.status,
        consumedAt: parsed.consumedAt,
        completedAt: parsed.completedAt,
      };
    }
  } catch (error) {
    console.warn("Failed to parse free trial state:", error);
  }

  return DEFAULT_FREE_TRIAL_STATE;
};

const persistState = async (state: FreeTrialState) => {
  await AsyncStorage.setItem(FREE_TRIAL_USED_KEY, JSON.stringify(state));
};

export const getFreeTrialState = async (): Promise<FreeTrialState> => {
  try {
    const value = await AsyncStorage.getItem(FREE_TRIAL_USED_KEY);
    return parseState(value);
  } catch (error) {
    console.warn("Failed to read free trial state:", error);
    return DEFAULT_FREE_TRIAL_STATE;
  }
};

export const markFreeTrialStarted = async () => {
  try {
    const existing = await getFreeTrialState();
    await persistState({
      status: "active",
      consumedAt: existing.consumedAt || new Date().toISOString(),
      completedAt: existing.completedAt,
    });
  } catch (error) {
    console.warn("Failed to persist free trial start state:", error);
  }
};

export const markFreeTrialCompleted = async () => {
  try {
    const existing = await getFreeTrialState();
    const now = new Date().toISOString();
    await persistState({
      status: "completed",
      consumedAt: existing.consumedAt || now,
      completedAt: now,
    });
  } catch (error) {
    console.warn("Failed to persist free trial completion state:", error);
  }
};

export const hasUsedFreeTrial = async (): Promise<boolean> => {
  try {
    const state = await getFreeTrialState();
    return state.status === "active" || state.status === "completed";
  } catch (error) {
    console.warn("Failed to read free trial state:", error);
    return false;
  }
};

export const resetFreeTrialState = async () => {
  try {
    await persistState(DEFAULT_FREE_TRIAL_STATE);
  } catch (error) {
    console.warn("Failed to reset free trial state:", error);
  }
};

// Backward-compatible alias used in older call sites.
export const markFreeTrialUsed = markFreeTrialStarted;
