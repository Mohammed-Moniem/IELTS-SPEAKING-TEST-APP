import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { practiceApi, simulationApi } from "../api/services";
import { useAuth } from "../auth/AuthContext";
import offlineStorage from "../services/offlineStorage";
import { logger } from "../utils/logger";
import { useNetworkStatus } from "./useNetworkStatus";

export const useOfflineSync = (): void => {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (!isOnline) return;
    if (syncingRef.current) return;

    syncingRef.current = true;

    const sync = async () => {
      try {
        const audio = await offlineStorage.processQueue(async (item) => {
          await practiceApi.uploadAudio(item.sessionId, item.audioUri, () => {});
        });

        const practiceText = await offlineStorage.processPracticeTextQueue(
          async (item) => {
            await practiceApi.completeSession(item.sessionId, {
              userResponse: item.userResponse,
              timeSpent: item.timeSpent,
            });
          }
        );

        const simulations = await offlineStorage.processSimulationCompletionQueue(
          async (item) => {
            await simulationApi.complete(item.simulationId, item.parts);
          }
        );

        const synced =
          audio.success + practiceText.success + simulations.success;
        if (synced > 0) {
          logger.success(
            "✅",
            "Offline sync complete:",
            `${synced} item${synced === 1 ? "" : "s"} synced`
          );

          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["practice-results"] }),
            queryClient.invalidateQueries({ queryKey: ["practice-sessions"] }),
            queryClient.invalidateQueries({ queryKey: ["simulation-results"] }),
            queryClient.invalidateQueries({ queryKey: ["test-simulations"] }),
            queryClient.invalidateQueries({ queryKey: ["usage-summary"] }),
          ]).catch(() => undefined);
        }
      } finally {
        syncingRef.current = false;
      }
    };

    sync().catch((error) => {
      syncingRef.current = false;
      logger.error("❌", "Offline sync failed:", error);
    });
  }, [isOnline, queryClient, user]);
};

