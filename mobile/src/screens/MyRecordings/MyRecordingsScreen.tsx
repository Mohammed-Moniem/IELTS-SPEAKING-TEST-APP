/**
 * My Recordings Screen
 * Displays user's audio recordings with playback, download, and delete options
 */

import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import {
  AudioRecording,
  deleteRecording,
  getAudioUrl,
  listUserRecordings,
} from "../../api/audioApi";
import type { ColorTokens } from "../../theme/tokens";
import { logger } from "../../utils/logger";

export const MyRecordingsScreen: React.FC = () => {
  const { user, initializing: authInitializing } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [recordings, setRecordings] = useState<AudioRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [filter, setFilter] = useState<"all" | "practice" | "simulation">(
    "all"
  );
  const userId = user?._id ?? null;
  const headerGradientColors = [colors.primaryStrong, colors.primary] as const;

  useEffect(() => {
    if (authInitializing) {
      return;
    }

    if (!userId) {
      setRecordings([]);
      setLoading(false);
      return;
    }

    loadRecordings();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, userId, authInitializing]);

  const loadRecordings = async () => {
    if (!userId) {
      return;
    }

    try {
      setLoading(true);
      const result = await listUserRecordings(userId, {
        limit: 50,
        recordingType: filter === "all" ? undefined : filter,
      });
      setRecordings(result.recordings);
    } catch (error) {
      logger.warn("⚠️ Failed to load recordings:", error);
      Alert.alert("Error", "Failed to load recordings");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!userId) {
      return;
    }
    setRefreshing(true);
    await loadRecordings();
    setRefreshing(false);
  };

  const handlePlayPause = async (recording: AudioRecording) => {
    try {
      if (playingId === recording.id) {
        // Pause current audio
        if (sound) {
          await sound.pauseAsync();
          setPlayingId(null);
        }
      } else {
        // Stop any currently playing audio
        if (sound) {
          await sound.stopAsync();
          await sound.unloadAsync();
        }

        // Load and play new audio
        const audioUrl = getAudioUrl(recording.id);
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true }
        );

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setPlayingId(null);
          }
        });

        setSound(newSound);
        setPlayingId(recording.id);
      }
    } catch (error) {
      logger.warn("⚠️ Error playing audio:", error);
      Alert.alert("Error", "Failed to play recording");
    }
  };

  const handleDelete = (recording: AudioRecording) => {
    Alert.alert(
      "Delete Recording",
      "Are you sure you want to delete this recording? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!userId) {
              Alert.alert("Sign in required", "Log in to manage recordings.");
              return;
            }
            const success = await deleteRecording(recording.id, userId);
            if (success) {
              setRecordings((prev) =>
                prev.filter((r) => r.id !== recording.id)
              );
              Alert.alert("Success", "Recording deleted");
            } else {
              Alert.alert("Error", "Failed to delete recording");
            }
          },
        },
      ]
    );
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getBandColor = (band: number): string => {
    if (band >= 8) return colors.success;
    if (band >= 7) return colors.primary;
    if (band >= 6) return colors.warning;
    return colors.danger;
  };

  const renderRecordingCard = (recording: AudioRecording) => {
    const isPlaying = playingId === recording.id;

    return (
      <View key={recording.id} style={styles.recordingCard}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.typeBadge}>
            <Ionicons
              name={
                recording.recordingType === "practice" ? "school" : "trophy"
              }
              size={14}
              color={colors.primaryOn}
            />
            <Text style={styles.typeBadgeText}>
              {recording.recordingType === "practice"
                ? "Practice"
                : "Simulation"}
            </Text>
          </View>
          {recording.overallBand && (
            <View
              style={[
                styles.bandBadge,
                { backgroundColor: getBandColor(recording.overallBand) },
              ]}
            >
              <Text style={styles.bandBadgeText}>
                {recording.overallBand.toFixed(1)}
              </Text>
            </View>
          )}
        </View>

        {/* Topic */}
        {recording.topic && (
          <Text style={styles.topicText}>{recording.topic}</Text>
        )}

        {/* Metadata */}
        <View style={styles.metadataRow}>
          <View style={styles.metadataItem}>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} />
            <Text style={styles.metadataText}>
              {formatDuration(recording.durationSeconds)}
            </Text>
          </View>
          <View style={styles.metadataItem}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={colors.textMuted}
            />
            <Text style={styles.metadataText}>
              {formatDate(recording.createdAt)}
            </Text>
          </View>
          <View style={styles.metadataItem}>
            <Ionicons
              name="document-outline"
              size={14}
              color={colors.textMuted}
            />
            <Text style={styles.metadataText}>
              {formatFileSize(recording.fileSizeBytes)}
            </Text>
          </View>
        </View>

        {/* Scores */}
        {recording.scores && (
          <View style={styles.scoresRow}>
            {recording.scores.fluencyCoherence && (
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>FC</Text>
                <Text style={styles.scoreValue}>
                  {recording.scores.fluencyCoherence.toFixed(1)}
                </Text>
              </View>
            )}
            {recording.scores.lexicalResource && (
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>LR</Text>
                <Text style={styles.scoreValue}>
                  {recording.scores.lexicalResource.toFixed(1)}
                </Text>
              </View>
            )}
            {recording.scores.grammaticalRange && (
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>GR</Text>
                <Text style={styles.scoreValue}>
                  {recording.scores.grammaticalRange.toFixed(1)}
                </Text>
              </View>
            )}
            {recording.scores.pronunciation && (
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>PR</Text>
                <Text style={styles.scoreValue}>
                  {recording.scores.pronunciation.toFixed(1)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handlePlayPause(recording)}
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={20}
              color={colors.primary}
            />
            <Text style={styles.actionButtonText}>
              {isPlaying ? "Pause" : "Play"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDelete(recording)}
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
            <Text style={[styles.actionButtonText, styles.deleteActionText]}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>

        {/* Expiry warning */}
        {recording.expiresAt && (
          <View style={styles.expiryWarning}>
            <Ionicons name="warning-outline" size={14} color={colors.warning} />
            <Text style={styles.expiryText}>
              Expires on {formatDate(recording.expiresAt)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (authInitializing) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={headerGradientColors} style={styles.header}>
          <Text style={styles.headerTitle}>My Recordings</Text>
        </LinearGradient>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading recordings...</Text>
        </View>
      </View>
    );
  }

  if (!userId) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={headerGradientColors} style={styles.header}>
          <Text style={styles.headerTitle}>My Recordings</Text>
        </LinearGradient>
        <View style={styles.centerContainer}>
          <Ionicons
            name="lock-closed-outline"
            size={64}
            color={colors.textMuted}
          />
          <Text style={styles.emptyTitle}>Sign in to access recordings</Text>
          <Text style={styles.emptySubtitle}>
            Log in to sync your practice audio and feedback
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={headerGradientColors} style={styles.header}>
        <Text style={styles.headerTitle}>My Recordings</Text>
        <Text style={styles.headerSubtitle}>
          {recordings.length} recording{recordings.length !== 1 ? "s" : ""}
        </Text>
      </LinearGradient>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === "all" && styles.filterTabActive]}
          onPress={() => setFilter("all")}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === "all" && styles.filterTabTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === "practice" && styles.filterTabActive,
          ]}
          onPress={() => setFilter("practice")}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === "practice" && styles.filterTabTextActive,
            ]}
          >
            Practice
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === "simulation" && styles.filterTabActive,
          ]}
          onPress={() => setFilter("simulation")}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === "simulation" && styles.filterTabTextActive,
            ]}
          >
            Simulation
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading recordings...</Text>
        </View>
      ) : recordings.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons
            name="musical-notes-outline"
            size={64}
            color={colors.textMuted}
          />
          <Text style={styles.emptyTitle}>No Recordings Yet</Text>
          <Text style={styles.emptySubtitle}>
            Your practice and simulation recordings will appear here
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {recordings.map(renderRecordingCard)}
          <View style={styles.bottomSpacing} />
        </ScrollView>
      )}
    </View>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: 60,
      paddingBottom: 20,
      paddingHorizontal: 20,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: "bold",
      color: colors.primaryOn,
      marginBottom: 5,
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    filterContainer: {
      flexDirection: "row",
      paddingHorizontal: 20,
      paddingVertical: 15,
      gap: 10,
      backgroundColor: colors.surfaceSubtle,
    },
    filterTab: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderRadius: 10,
      backgroundColor: colors.surface,
      alignItems: "center",
    },
    filterTabActive: {
      backgroundColor: colors.primary,
    },
    filterTabText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textMuted,
    },
    filterTabTextActive: {
      color: colors.primaryOn,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
    },
    recordingCard: {
      backgroundColor: colors.surface,
      borderRadius: 15,
      padding: 15,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: colors.borderMuted,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    typeBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      gap: 5,
    },
    typeBadgeText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primaryOn,
    },
    bandBadge: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 12,
    },
    bandBadgeText: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.primaryOn,
    },
    topicText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 10,
    },
    metadataRow: {
      flexDirection: "row",
      gap: 15,
      marginBottom: 10,
    },
    metadataItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    metadataText: {
      fontSize: 12,
      color: colors.textMuted,
    },
    scoresRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 10,
    },
    scoreItem: {
      flex: 1,
      backgroundColor: colors.surfaceSubtle,
      padding: 8,
      borderRadius: 8,
      alignItems: "center",
    },
    scoreLabel: {
      fontSize: 10,
      color: colors.textMuted,
      marginBottom: 2,
    },
    scoreValue: {
      fontSize: 14,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    actionsRow: {
      flexDirection: "row",
      gap: 10,
    },
    actionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 10,
      gap: 5,
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.primary,
    },
    deleteActionText: {
      color: colors.danger,
    },
    expiryWarning: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.borderMuted,
    },
    expiryText: {
      fontSize: 12,
      color: colors.warning,
    },
    centerContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 40,
    },
    loadingText: {
      marginTop: 15,
      fontSize: 16,
      color: colors.textMuted,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginTop: 20,
      marginBottom: 10,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "center",
    },
    bottomSpacing: {
      height: 40,
    },
  });
