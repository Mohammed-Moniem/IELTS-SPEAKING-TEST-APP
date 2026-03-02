/**
 * ToastService
 * Provides debounced, non-intrusive notifications for points and achievements
 * Prevents notification spam by queueing and batching messages
 */

import { Platform } from "react-native";
import { logger } from "../utils/logger";

export type ToastType = "success" | "info" | "warning" | "error";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

type ToastListener = (toast: Toast) => void;

class ToastServiceClass {
  private listeners: Set<ToastListener> = new Set();
  private toastQueue: Toast[] = [];
  private isProcessing = false;
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_DELAY = 1000; // 1 second debounce
  private readonly DEFAULT_DURATION = 3000; // 3 seconds
  private recentMessages: Map<string, number> = new Map();
  private readonly SPAM_THRESHOLD = 5000; // Don't show same message within 5 seconds

  /**
   * Subscribe to toast notifications
   */
  subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Show a toast notification (debounced)
   */
  show(
    message: string,
    type: ToastType = "info",
    duration: number = this.DEFAULT_DURATION
  ): void {
    // Check if this message was shown recently (spam prevention)
    const lastShown = this.recentMessages.get(message);
    const now = Date.now();

    if (lastShown && now - lastShown < this.SPAM_THRESHOLD) {
      logger.debug("Toast spam prevented", { message });
      return;
    }

    const toast: Toast = {
      id: `toast-${Date.now()}-${Math.random()}`,
      message,
      type,
      duration,
    };

    this.toastQueue.push(toast);
    this.recentMessages.set(message, now);

    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new debounce timer
    this.debounceTimer = setTimeout(() => {
      this.processQueue();
    }, this.DEBOUNCE_DELAY);
  }

  /**
   * Show success toast
   */
  success(message: string, duration?: number): void {
    this.show(message, "success", duration);
  }

  /**
   * Show info toast
   */
  info(message: string, duration?: number): void {
    this.show(message, "info", duration);
  }

  /**
   * Show warning toast
   */
  warning(message: string, duration?: number): void {
    this.show(message, "warning", duration);
  }

  /**
   * Show error toast
   */
  error(message: string, duration?: number): void {
    this.show(message, "error", duration);
  }

  /**
   * Show achievement unlocked toast
   */
  achievementUnlocked(achievementName: string, points: number): void {
    this.success(`🏆 ${achievementName} (+${points} pts)`, 4000);
  }

  /**
   * Show points granted toast (only for smaller amounts, celebration modal handles large amounts)
   */
  pointsGranted(amount: number, reason: string): void {
    // Only show toast for small point amounts (< 50)
    // Large amounts should use the celebration modal
    if (amount < 50) {
      this.success(`+${amount} pts • ${reason}`, 3000);
    }
  }

  /**
   * Show discount redeemed toast
   */
  discountRedeemed(tierName: string, discountPercent: number): void {
    this.success(
      `🎉 ${tierName} Discount Unlocked! ${discountPercent}% off`,
      5000
    );
  }

  /**
   * Process the queued toasts
   */
  private processQueue(): void {
    if (this.isProcessing || this.toastQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    // Get the next toast from queue
    const toast = this.toastQueue.shift();

    if (toast) {
      // Notify all listeners
      this.listeners.forEach((listener) => {
        try {
          listener(toast);
        } catch (error) {
          logger.error("Error in toast listener", error);
        }
      });
    }

    // Reset processing flag after a short delay
    setTimeout(() => {
      this.isProcessing = false;
      // Process next toast if queue has items
      if (this.toastQueue.length > 0) {
        this.processQueue();
      }
    }, 500);
  }

  /**
   * Clear all toasts
   */
  clear(): void {
    this.toastQueue = [];
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Clean up old messages from spam prevention cache
   */
  cleanupCache(): void {
    const now = Date.now();
    for (const [message, timestamp] of this.recentMessages.entries()) {
      if (now - timestamp > this.SPAM_THRESHOLD * 2) {
        this.recentMessages.delete(message);
      }
    }
  }
}

// Singleton instance
export const toastService = new ToastServiceClass();

// Clean up cache every minute
if (Platform.OS !== "web") {
  setInterval(() => {
    toastService.cleanupCache();
  }, 60000);
}
