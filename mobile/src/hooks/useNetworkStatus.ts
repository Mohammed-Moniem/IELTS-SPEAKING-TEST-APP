/**
 * Network Status Hook
 * Monitors device network connection status
 */

import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

interface NetworkStatus {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string | null;
  isOffline: boolean;
  isOnline: boolean;
}

export const useNetworkStatus = () => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: null,
    isInternetReachable: null,
    type: null,
    isOffline: false,
    isOnline: false,
  });

  useEffect(() => {
    // Get initial state
    NetInfo.fetch().then((state) => {
      updateNetworkStatus(state);
    });

    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener((state) => {
      updateNetworkStatus(state);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const updateNetworkStatus = (state: NetInfoState) => {
    const isConnected = state.isConnected ?? false;
    const isInternetReachable = state.isInternetReachable ?? false;

    setNetworkStatus({
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      isOffline: !isConnected || !isInternetReachable,
      isOnline: isConnected && isInternetReachable,
    });

    // Log connection changes
    if (!isConnected || !isInternetReachable) {
      console.log("📡 Network: OFFLINE");
    } else {
      console.log("📡 Network: ONLINE", `(${state.type})`);
    }
  };

  return networkStatus;
};
