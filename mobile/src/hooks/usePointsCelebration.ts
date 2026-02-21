/**
 * usePointsCelebration Hook
 * Manages celebration modal state for points events
 * Listens to socket events and shows celebration modal
 */

import { useCallback, useEffect, useState } from "react";
import firebaseAnalyticsService from "../services/firebaseAnalyticsService";
import monitoringService from "../services/monitoringService";
import socketService from "../services/socketService";
import { logger } from "../utils/logger";

interface PointsGrantedEvent {
  userId: string;
  amount: number;
  type: string;
  description: string;
  balance: number;
  metadata?: Record<string, any>;
}

interface CelebrationState {
  visible: boolean;
  pointsEarned: number;
  reason: string;
  newBalance: number;
}

export const usePointsCelebration = () => {
  const [celebration, setCelebration] = useState<CelebrationState>({
    visible: false,
    pointsEarned: 0,
    reason: "",
    newBalance: 0,
  });

  const showCelebration = useCallback(
    (pointsEarned: number, reason: string, newBalance: number) => {
      setCelebration({
        visible: true,
        pointsEarned,
        reason,
        newBalance,
      });

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        hideCelebration();
      }, 5000);
    },
    []
  );

  const hideCelebration = useCallback(() => {
    setCelebration((prev) => ({ ...prev, visible: false }));
  }, []);

  useEffect(() => {
    const handlePointsGranted = (event: PointsGrantedEvent) => {
      logger.info("Points granted event received", event);

      // Track celebration display
      try {
        monitoringService.trackEvent("points_celebration_shown", {
          amount: event.amount,
          type: event.type,
        });
        void firebaseAnalyticsService.trackEvent("points_celebration_shown", {
          amount: event.amount,
          type: event.type,
        });
      } catch (err) {
        logger.warn(
          "⚠️ Analytics track for points_celebration_shown failed",
          err
        );
      }

      showCelebration(event.amount, event.description, event.balance);
    };

    // Subscribe to points granted events
    socketService.on("points:granted", handlePointsGranted);

    return () => {
      socketService.off("points:granted", handlePointsGranted);
    };
  }, [showCelebration]);

  return {
    celebration,
    showCelebration,
    hideCelebration,
  };
};
