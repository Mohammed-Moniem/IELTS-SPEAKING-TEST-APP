import { useCallback, useEffect, useState } from "react";

import socketService, { OnlineStatus } from "../services/socketService";

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Initialize socket connection
    socketService.connect();

    // Listen for connection changes
    const handleConnectionChange = (connected: boolean) => {
      setIsConnected(connected);
    };

    // Listen for online status updates
    const handleOnlineStatus = ({ userId, isOnline }: OnlineStatus) => {
      setOnlineUsers((prev) => {
        const newSet = new Set(prev);
        if (isOnline) {
          newSet.add(userId);
        } else {
          newSet.delete(userId);
        }
        return newSet;
      });
    };

    socketService.onConnectionChange(handleConnectionChange);
    socketService.onOnlineStatus(handleOnlineStatus);

    // Cleanup on unmount - CRITICAL for preventing memory leaks
    return () => {
      // Remove callback listeners
      socketService.offConnectionChange(handleConnectionChange);
      socketService.offOnlineStatus(handleOnlineStatus);

      // Disconnect socket and clean up all event listeners
      // Only disconnect if this is the last component using the socket
      // (In production, you might want to keep socket alive and only disconnect on logout)
      socketService.disconnect();
    };
  }, []);

  const isUserOnline = useCallback(
    (userId: string) => {
      return onlineUsers.has(userId);
    },
    [onlineUsers]
  );

  const reconnect = useCallback(() => {
    socketService.connect();
  }, []);

  const disconnect = useCallback(() => {
    socketService.disconnect();
  }, []);

  return {
    isConnected,
    onlineUsers,
    isUserOnline,
    reconnect,
    disconnect,
  };
};
