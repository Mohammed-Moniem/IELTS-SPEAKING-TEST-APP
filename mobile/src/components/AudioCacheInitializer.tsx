/**
 * Audio Cache Initializer
 * Handles pre-caching of repetitive examiner phrases in the background
 * Shows progress UI during initial cache download
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../context";
import { useThemedStyles } from "../hooks";
import { audioCacheService } from "../services/audioCacheService";
import type { ColorTokens } from "../theme/tokens";
import { spacing } from "../theme/tokens";

const CACHE_INIT_KEY = "@audio_cache_initialized";

interface AudioCacheInitializerProps {
  children: React.ReactNode;
}

export const AudioCacheInitializer: React.FC<AudioCacheInitializerProps> = ({
  children,
}) => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [isInitializing, setIsInitializing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentPhrase, setCurrentPhrase] = useState("");
  const hasInitializedRef = useRef(false);

  const initializeCache = useCallback(async () => {
    if (hasInitializedRef.current) {
      return;
    }
    try {
      // Check if we need to cache
      const needsCache = await audioCacheService.needsCacheUpdate();

      if (!needsCache) {
        console.log("✅ Audio cache already initialized");
        return;
      }

      console.log("🚀 Initializing audio cache...");
      setIsInitializing(true);

      // Pre-cache all phrases
      await audioCacheService.preCacheAllPhrases((current, total, phraseId) => {
        setProgress({ current, total });
        setCurrentPhrase(phraseId);
        console.log(`📥 Caching phrase ${current}/${total}: ${phraseId}`);
      });

      // Mark as initialized
      await AsyncStorage.setItem(CACHE_INIT_KEY, "true");

      console.log("✅ Audio cache initialization complete");
      setIsInitializing(false);
      hasInitializedRef.current = true;
    } catch (error: any) {
      if (error?.response?.status === 401) {
        console.warn(
          "⚠️ Audio cache skipped: unauthorized to access speech synthesis endpoint."
        );
      } else {
        console.error("❌ Audio cache initialization failed:", error);
      }
      // Don't block app startup on cache failure
      // The app will fallback to live TTS
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    if (!user || user.isGuest) {
      setIsInitializing(false);
      return;
    }
    void initializeCache();
  }, [user, initializeCache]);

  return (
    <>
      {children}
      <Modal
        visible={isInitializing}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.title}>Optimizing Audio</Text>
            <Text style={styles.subtitle}>
              Downloading examiner voice phrases...
            </Text>
            <Text style={styles.progress}>
              {progress.current} of {progress.total}
            </Text>
            <Text style={styles.phraseId} numberOfLines={2}>
              {currentPhrase.replace(/_/g, " ")}
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: spacing.xl,
      alignItems: "center",
      minWidth: 280,
      maxWidth: "90%",
    },
    title: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginTop: spacing.md,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: spacing.sm,
      textAlign: "center",
    },
    progress: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.primary,
      marginTop: spacing.md,
    },
    phraseId: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: spacing.xs,
      textAlign: "center",
      fontStyle: "italic",
    },
  });
