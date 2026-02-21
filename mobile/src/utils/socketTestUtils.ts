/**
 * Socket Cleanup Test Utility
 *
 * This file provides utilities to test and verify that socket cleanup
 * is working correctly and no memory leaks are occurring.
 *
 * Usage:
 * 1. Import this utility in your test file or debugging component
 * 2. Call testSocketCleanup() to simulate mount/unmount cycles
 * 3. Check diagnostics with getSocketDiagnostics()
 */

import socketService from "../services/socketService";
import { logger } from "./logger";

/**
 * Test socket cleanup by simulating mount/unmount cycles
 */
export const testSocketCleanup = async (cycles: number = 5): Promise<void> => {
  logger.info("🧪 Starting socket cleanup test...");
  logger.info(`Will run ${cycles} connect/disconnect cycles`);

  for (let i = 1; i <= cycles; i++) {
    logger.info(`\n--- Cycle ${i}/${cycles} ---`);

    // Connect
    logger.info("Connecting...");
    await socketService.connect();
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s

    // Get diagnostics before disconnect
    const beforeDisconnect = socketService.getDiagnostics();
    logger.info("Before disconnect:", beforeDisconnect);

    // Disconnect
    logger.info("Disconnecting...");
    socketService.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 500ms

    // Get diagnostics after disconnect
    const afterDisconnect = socketService.getDiagnostics();
    logger.info("After disconnect:", afterDisconnect);

    // Verify cleanup
    if (afterDisconnect.activeListeners > 0) {
      logger.error(
        `❌ Memory leak detected! ${afterDisconnect.activeListeners} listeners still active`
      );
      logger.error("Active listener types:", afterDisconnect.listenerTypes);
    } else {
      logger.info("✅ No memory leaks detected");
    }

    if (
      afterDisconnect.hasCallbacks.message ||
      afterDisconnect.hasCallbacks.typing ||
      afterDisconnect.hasCallbacks.onlineStatus
    ) {
      logger.warn(
        "⚠️ Some callbacks still registered:",
        afterDisconnect.hasCallbacks
      );
    }
  }

  logger.info("\n🏁 Socket cleanup test complete");
};

/**
 * Get current socket diagnostics
 */
export const getSocketDiagnostics = () => {
  const diagnostics = socketService.getDiagnostics();

  logger.info("📊 Socket Diagnostics:");
  logger.info("- Connected:", diagnostics.isConnected);
  logger.info("- Connecting:", diagnostics.isConnecting);
  logger.info("- Has Socket:", diagnostics.hasSocket);
  logger.info("- Socket ID:", diagnostics.socketId || "N/A");
  logger.info("- Active Listeners:", diagnostics.activeListeners);
  logger.info("- Listener Types:", diagnostics.listenerTypes);
  logger.info("- Callbacks:", diagnostics.hasCallbacks);
  logger.info("- Reconnect Attempts:", diagnostics.reconnectAttempts);

  return diagnostics;
};

/**
 * Monitor socket for memory leaks over time
 * Returns a stop function to end monitoring
 */
export const monitorSocketMemory = (
  intervalMs: number = 5000
): (() => void) => {
  logger.info("🔍 Starting socket memory monitoring...");
  logger.info(`Will check every ${intervalMs}ms`);

  const baselineDiagnostics = socketService.getDiagnostics();
  logger.info("📊 Baseline:", baselineDiagnostics);

  const intervalId = setInterval(() => {
    const current = socketService.getDiagnostics();

    // Check for growing listener count (memory leak indicator)
    if (current.activeListeners > baselineDiagnostics.activeListeners) {
      logger.warn("⚠️ Listener count increased!");
      logger.warn(
        `Baseline: ${baselineDiagnostics.activeListeners}, Current: ${current.activeListeners}`
      );
      logger.warn(
        "New listener types:",
        current.listenerTypes.filter(
          (t) => !baselineDiagnostics.listenerTypes.includes(t)
        )
      );
    }

    // Check for reconnection issues
    if (current.reconnectAttempts > 3) {
      logger.warn(`⚠️ High reconnect attempts: ${current.reconnectAttempts}`);
    }

    logger.info("📊 Current:", current);
  }, intervalMs);

  // Return stop function
  return () => {
    clearInterval(intervalId);
    logger.info("🛑 Socket memory monitoring stopped");
  };
};

/**
 * Verify cleanup after component unmount
 * Use this in useEffect cleanup to verify proper cleanup
 */
export const verifyCleanup = (componentName: string): void => {
  const diagnostics = socketService.getDiagnostics();

  if (diagnostics.activeListeners > 0) {
    logger.error(`❌ ${componentName}: Memory leak detected!`);
    logger.error(
      `${diagnostics.activeListeners} listeners still active:`,
      diagnostics.listenerTypes
    );
  } else {
    logger.info(`✅ ${componentName}: Cleanup successful, no memory leaks`);
  }
};

/**
 * Force cleanup (for testing only)
 */
export const forceSocketCleanup = (): void => {
  logger.warn(
    "⚠️ Force cleanup called - this should only be used for testing!"
  );
  socketService.forceCleanup();
};

/**
 * Example usage in a component:
 *
 * ```typescript
 * import { useEffect } from 'react';
 * import { verifyCleanup, getSocketDiagnostics } from '../utils/socketTestUtils';
 *
 * const MyComponent = () => {
 *   useEffect(() => {
 *     // Component mount
 *     console.log('Component mounted');
 *     getSocketDiagnostics();
 *
 *     // Cleanup on unmount
 *     return () => {
 *       console.log('Component unmounting');
 *       verifyCleanup('MyComponent');
 *     };
 *   }, []);
 *
 *   return <View>...</View>;
 * };
 * ```
 *
 * For manual testing:
 *
 * ```typescript
 * import { testSocketCleanup, monitorSocketMemory } from '../utils/socketTestUtils';
 *
 * // Run cleanup test
 * testSocketCleanup(10);
 *
 * // Monitor memory over time
 * const stopMonitoring = monitorSocketMemory(5000);
 * // ... use the app ...
 * stopMonitoring(); // Stop when done
 * ```
 */

export default {
  testSocketCleanup,
  getSocketDiagnostics,
  monitorSocketMemory,
  verifyCleanup,
  forceSocketCleanup,
};
