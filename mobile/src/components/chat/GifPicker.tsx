import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// Initialize Giphy SDK (you'll need to get an API key from https://developers.giphy.com/)
const GIPHY_API_KEY = process.env.GIPHY_API_KEY || "YOUR_GIPHY_API_KEY_HERE";

// Dynamically import Giphy SDK (optional dependency)
let GiphySDK: any = null;
let GiphyDialog: any = null;
let GiphyContentType: any = null;
let GiphyRating: any = null;

try {
  const giphyModule = require("@giphy/react-native-sdk");
  GiphySDK = giphyModule.GiphySDK;
  GiphyDialog = giphyModule.GiphyDialog;
  GiphyContentType = giphyModule.GiphyContentType;
  GiphyRating = giphyModule.GiphyRating;
} catch (error) {
  console.warn(
    "Giphy SDK not available - GIF picker will be disabled. Use a development build to enable GIF support."
  );
}

interface GifPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectGif: (gifUrl: string, width: number, height: number) => void;
}

/**
 * GIF Picker component using Giphy SDK
 */
export const GifPicker: React.FC<GifPickerProps> = ({
  visible,
  onClose,
  onSelectGif,
}) => {
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize Giphy SDK
  React.useEffect(() => {
    if (!GiphySDK || !GiphyDialog) {
      // SDK not available (e.g., in Expo Go)
      return;
    }

    if (GIPHY_API_KEY && GIPHY_API_KEY !== "YOUR_GIPHY_API_KEY_HERE") {
      try {
        GiphySDK.configure({ apiKey: GIPHY_API_KEY });
        setIsInitialized(true);
      } catch (error) {
        console.error("Error initializing Giphy SDK:", error);
      }
    }
  }, []);

  // Configure Giphy Dialog
  React.useEffect(() => {
    if (!isInitialized || !GiphyDialog || !GiphyContentType || !GiphyRating)
      return;

    const config: any = {
      mediaTypeConfig: [GiphyContentType.Gif, GiphyContentType.Sticker],
      rating: GiphyRating.PG13,
      showConfirmationScreen: false,
      shouldLocalizeSearch: true,
    };

    GiphyDialog.configure(config);

    // Set up media selection listener
    const listener = GiphyDialog.addListener("onMediaSelect", (e: any) => {
      // Get the downsized GIF URL (good balance between quality and size)
      const gifUrl =
        e.data.images?.downsized?.url || e.data.images?.original?.url;
      const width =
        e.data.images?.downsized?.width ||
        e.data.images?.original?.width ||
        200;
      const height =
        e.data.images?.downsized?.height ||
        e.data.images?.original?.height ||
        200;

      if (gifUrl) {
        onSelectGif(gifUrl, width, height);
      }

      GiphyDialog.hide();
      onClose();
    });

    // Set up dismiss listener
    const dismissListener = GiphyDialog.addListener("onDismiss", () => {
      onClose();
    });

    return () => {
      listener.remove();
      dismissListener.remove();
    };
  }, [isInitialized, onSelectGif, onClose]);

  // Show Giphy Dialog when visible
  React.useEffect(() => {
    if (visible && isInitialized) {
      GiphyDialog.show();
    }
  }, [visible, isInitialized]);

  // Fallback UI for when SDK is not initialized or not available
  if (visible && (!GiphySDK || !GiphyDialog || !isInitialized)) {
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.fallbackContainer}>
          <View style={styles.fallbackContent}>
            <Ionicons name="warning-outline" size={48} color="#FF6B6B" />
            <Text style={styles.fallbackTitle}>GIF Picker Unavailable</Text>
            <Text style={styles.fallbackMessage}>
              {!GiphySDK || !GiphyDialog
                ? "GIF picker requires a development build.\n\nThis feature is not available in Expo Go.\n\nRun 'npx expo prebuild' and build the app to enable GIF support."
                : GIPHY_API_KEY === "YOUR_GIPHY_API_KEY_HERE"
                ? "Please configure your Giphy API key to use GIF picker.\n\nGet your API key from: https://developers.giphy.com/"
                : "Failed to initialize Giphy SDK. Please check your API key and try again."}
            </Text>
            <TouchableOpacity style={styles.fallbackButton} onPress={onClose}>
              <Text style={styles.fallbackButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  fallbackContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  fallbackContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  fallbackTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F1F1F",
    marginTop: 16,
    marginBottom: 12,
    textAlign: "center",
  },
  fallbackMessage: {
    fontSize: 14,
    color: "#667781",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  fallbackButton: {
    backgroundColor: "#25D366",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  fallbackButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default GifPicker;
