import {
  NavigationContainerRefWithCurrent,
  createNavigationContainerRef,
} from "@react-navigation/native";

type RootParamList = Record<string, object | undefined>;

export const navigationRef: NavigationContainerRefWithCurrent<RootParamList> =
  createNavigationContainerRef<RootParamList>();

export const waitForNavigationReady = async (
  timeoutMs: number = 1500
): Promise<void> => {
  const start = Date.now();

  while (!navigationRef.isReady()) {
    if (Date.now() - start > timeoutMs) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

