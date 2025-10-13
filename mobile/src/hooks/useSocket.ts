import { useCallback, useEffect, useState } from "react";
import socketService from "../services/socketService";

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
    const handleOnlineStatus = (userId: string, isOnline: boolean) => {
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

    // Cleanup on unmount
    return () => {
      // Keep connection alive but remove listeners if needed
      // socketService.disconnect() would be called when app closes
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
