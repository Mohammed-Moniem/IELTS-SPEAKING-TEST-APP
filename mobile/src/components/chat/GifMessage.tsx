import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";

interface GifMessageProps {
  gifUrl: string;
  width?: number;
  height?: number;
  isOwnMessage: boolean;
  timestamp: Date;
  isLoading?: boolean;
  headers?: Record<string, string>;
}

/**
 * GIF message component for chat
 * Displays animated GIF in WhatsApp-style bubble
 */
export const GifMessage: React.FC<GifMessageProps> = ({
  gifUrl,
  width = 200,
  height = 200,
  isOwnMessage,
  timestamp,
  isLoading = false,
  headers,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Calculate GIF dimensions (maintain aspect ratio, max 250x250)
  const MAX_SIZE = 250;
  const aspectRatio = width / height;
  let gifWidth = MAX_SIZE;
  let gifHeight = MAX_SIZE;

  if (aspectRatio > 1) {
    // Landscape
    gifHeight = MAX_SIZE / aspectRatio;
  } else {
    // Portrait
    gifWidth = MAX_SIZE * aspectRatio;
  }

  const formatTime = (): string => {
    const time = new Date(timestamp);
    return time.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  return (
    <View
      style={[
        styles.container,
        isOwnMessage ? styles.ownMessage : styles.otherMessage,
      ]}
    >
      <View
        style={[styles.gifContainer, { width: gifWidth, height: gifHeight }]}
      >
        {/* GIF Image */}
        {!error && (
          <Image
            source={{ uri: gifUrl, headers }}
            style={styles.gif}
            onLoadStart={() => setLoading(true)}
            onLoad={handleLoad}
            onError={handleError}
            resizeMode="cover"
          />
        )}

        {/* Loading indicator */}
        {(loading || isLoading) && !error && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primaryOn} />
          </View>
        )}

        {/* Error state */}
        {error && (
          <View style={styles.errorOverlay}>
            <Ionicons
              name="alert-circle-outline"
              size={48}
              color={colors.danger}
            />
            <Text style={styles.errorText}>Failed to load GIF</Text>
          </View>
        )}

        {/* GIF badge */}
        <View style={styles.gifBadge}>
          <Text style={styles.gifBadgeText}>GIF</Text>
        </View>
      </View>

      {/* Footer with timestamp */}
      <View style={styles.footer}>
        <Text style={[styles.timestamp, isOwnMessage && styles.ownTimestamp]}>
          {formatTime()}
        </Text>
        {isOwnMessage && (
          <Ionicons
            name="checkmark-done"
            size={16}
            color={colors.info}
            style={styles.readReceipt}
          />
        )}
      </View>

      {/* WhatsApp-style tail */}
      <View
        style={[styles.tail, isOwnMessage ? styles.ownTail : styles.otherTail]}
      />
    </View>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  container: {
    maxWidth: "75%",
    borderRadius: 12,
    padding: 4,
    marginVertical: 2,
    position: "relative",
  },
  ownMessage: {
    alignSelf: "flex-end",
    backgroundColor: colors.successSoft,
    marginRight: 8,
  },
  otherMessage: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    marginLeft: 8,
  },
  gifContainer: {
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.borderMuted,
    position: "relative",
  },
  gif: {
    width: "100%",
    height: "100%",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlayBackdrop,
    justifyContent: "center",
    alignItems: "center",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surfaceSubtle,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    color: colors.danger,
    textAlign: "center",
  },
  gifBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: colors.overlayBackdrop,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gifBadgeText: {
    color: colors.primaryOn,
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 2,
  },
  timestamp: {
    fontSize: 11,
    color: colors.textMuted,
  },
  ownTimestamp: {
    color: colors.textMuted,
  },
  readReceipt: {
    marginLeft: 4,
  },
  tail: {
    position: "absolute",
    bottom: 0,
    width: 0,
    height: 0,
    borderStyle: "solid",
  },
  ownTail: {
    right: -8,
    borderLeftWidth: 10,
    borderRightWidth: 0,
    borderTopWidth: 10,
    borderBottomWidth: 0,
    borderLeftColor: colors.successSoft,
    borderRightColor: "transparent",
    borderTopColor: colors.successSoft,
    borderBottomColor: "transparent",
  },
  otherTail: {
    left: -8,
    borderLeftWidth: 0,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderBottomWidth: 0,
    borderLeftColor: "transparent",
    borderRightColor: colors.surface,
    borderTopColor: colors.surface,
    borderBottomColor: "transparent",
  },
});

export default GifMessage;
