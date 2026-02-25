import { API_URL, apiClient } from "./client";
import { logger } from "../utils/logger";

/**
 * Test backend connectivity
 * Call this on app startup to diagnose network issues
 */
export const testBackendConnection = async () => {
  console.log("\n🔍 Testing Backend Connection...");
  console.log("📍 Target URL:", API_URL);

  try {
    // Test 1: Basic HTTP request
    console.log("\n1️⃣ Testing basic connectivity...");
    const response = await fetch(`${API_URL.replace("/api/v1", "")}/`, {
      method: "GET",
      headers: {
        "x-api-key": "local-dev-api-key",
      },
    });

    console.log("✅ Basic connectivity OK");
    console.log("Status:", response.status);

    // Test 2: Health check endpoint
    console.log("\n2️⃣ Testing health endpoint...");
    try {
      const healthResponse = await apiClient.get("/health");
      console.log("✅ Health check OK:", healthResponse.data);
    } catch (healthError: any) {
      console.log("⚠️ Health endpoint not available:", healthError.message);
    }

    // Test 3: Topics endpoint (public)
    console.log("\n3️⃣ Testing topics endpoint...");
    try {
      const topicsResponse = await apiClient.get("/topics");
      console.log("✅ Topics endpoint OK");
      console.log("Topics count:", topicsResponse.data?.data?.length || 0);
    } catch (topicsError: any) {
      console.log(
        "⚠️ Topics endpoint error:",
        topicsError.response?.status,
        topicsError.message
      );
    }

    console.log("\n✅ Backend connection test complete!\n");
    return true;
  } catch (error: any) {
    logger.warn("\n❌ Backend connection test FAILED");
    logger.warn("Error:", error.message);

    if (
      error.message === "Network request failed" ||
      error.message.includes("Network")
    ) {
      logger.warn("\n🔴 NETWORK ERROR - Troubleshooting:");
      logger.warn(
        '1. Is backend running? Check terminal for "app is ready on http://0.0.0.0:4000"'
      );
      logger.warn(
        "2. Same WiFi? Mobile and computer must be on same network"
      );
      logger.warn("3. Firewall? Check macOS firewall settings");
      logger.warn("4. IP correct? Current IP in app.json:", API_URL);
      logger.warn(
        '\n💡 To fix: Update mobile/app.json "extra.apiUrl" with your Mac IP'
      );
      logger.warn(
        "   Find your IP: System Settings → Network → WiFi → Details"
      );
    }

    return false;
  }
};

/**
 * Get device network info
 */
export const getNetworkInfo = () => {
  console.log("\n📱 Mobile App Network Info:");
  console.log("API URL:", API_URL);
  console.log("API Key: local-dev-api-key");
  console.log("Timeout: 30 seconds");
  console.log("\n");
};
