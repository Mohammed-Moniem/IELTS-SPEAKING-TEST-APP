import AsyncStorage from "@react-native-async-storage/async-storage";

const FREE_TRIAL_USED_KEY = "has_used_free_trial";

export const markFreeTrialUsed = async () => {
  try {
    await AsyncStorage.setItem(FREE_TRIAL_USED_KEY, "true");
  } catch (error) {
    console.warn("Failed to persist free trial state:", error);
  }
};

export const hasUsedFreeTrial = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(FREE_TRIAL_USED_KEY);
    return value === "true";
  } catch (error) {
    console.warn("Failed to read free trial state:", error);
    return false;
  }
};

