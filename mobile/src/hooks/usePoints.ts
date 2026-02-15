/**
 * usePoints Hook
 * Re-exports the Points Context for backward compatibility
 * All state is now managed centrally in PointsContext to prevent duplicate API calls
 */

import { usePointsContext } from "../context/PointsContext";

export interface PointsGrantedEvent {
  userId: string;
  amount: number;
  type: string;
  description: string;
  balance: number;
  metadata?: Record<string, any>;
}

/**
 * Hook to access points data from the centralized PointsContext
 * This prevents duplicate API calls when multiple components use points data
 */
export const usePoints = () => {
  return usePointsContext();
};
