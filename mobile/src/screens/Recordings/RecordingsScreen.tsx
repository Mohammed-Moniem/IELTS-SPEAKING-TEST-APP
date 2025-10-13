/**
 * Recordings Screen
 * Display and playback past audio recordings
 */

import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { practiceApi } from "../../api/services";
import { AudioPlayer } from "../../components/AudioPlayer";

interface Recording {
  id: string;
  sessionId: string;
  partNumber: number;
  questionNumber: number;
  topicTitle: string;
  questionText: string;
  audioUrl: string;
  duration: number; // seconds
  score?: number;
  createdAt: string;
}

export const RecordingsScreen: React.FC = () => {
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(
    null
  );

  // Fetch recordings from API
  const {
    data: recordings,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["recordings"],
    queryFn: async () => {
      // Get practice sessions that have audio files
      const sessions = await practiceApi.listSessions({ limit: 100 });

      // Filter sessions that have audio and transform to Recording type
      const recordings: Recording[] = sessions
        .filter((session) => session.audioUrl)
        .map((session) => ({
          id: session._id,
          sessionId: session._id,
          partNumber: session.part || 1,
          questionNumber: 1,
          topicTitle: session.topicTitle || "Untitled Topic",
          questionText: session.question || "No question",
          audioUrl: session.audioUrl!,
          duration: Math.floor(session.timeSpent || 0),
          score: session.feedback?.overallBand,
          createdAt: session.createdAt,
        }));

      return recordings;
    },
  });

  // Handle recording selection
  const handleSelectRecording = (recording: Recording) => {
    setSelectedRecording(recording);
  };

  // Handle delete recording
  const handleDeleteRecording = (recordingId: string) => {
    Alert.alert(
      "Delete Recording",
      "Are you sure you want to delete this recording?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Note: Backend would need a delete endpoint
              // await practiceApi.deleteSession(recordingId);
              Alert.alert("Info", "Delete functionality coming soon");
              // refetch(); // Refresh list
            } catch (error) {
              Alert.alert("Error", "Failed to delete recording");
            }
          },
        },
      ]
    );
  };

  // Format duration (seconds to MM:SS)
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Render recording item
  const renderRecording = ({ item }: { item: Recording }) => {
    const isSelected = selectedRecording?.id === item.id;

    return (
      <TouchableOpacity
        style={[styles.recordingCard, isSelected && styles.recordingCardActive]}
        onPress={() => handleSelectRecording(item)}
      >
        <View style={styles.recordingHeader}>
          <View style={styles.recordingInfo}>
            <Text style={styles.topicTitle} numberOfLines={1}>
              {item.topicTitle}
            </Text>
            <Text style={styles.questionText} numberOfLines={2}>
              {item.questionText}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDeleteRecording(item.id)}
            style={styles.deleteButton}
          >
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <View style={styles.recordingMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color="#6B7280" />
            <Text style={styles.metaText}>{formatDate(item.createdAt)}</Text>
          </View>

          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color="#6B7280" />
            <Text style={styles.metaText}>{formatDuration(item.duration)}</Text>
          </View>

          <View style={styles.metaItem}>
            <Ionicons name="document-text-outline" size={14} color="#6B7280" />
            <Text style={styles.metaText}>
              Part {item.partNumber} Q{item.questionNumber}
            </Text>
          </View>

          {item.score && (
            <View style={styles.metaItem}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={styles.scoreText}>{item.score}/9</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Loading recordings...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Failed to load recordings</Text>
          <Text style={styles.errorSubtext}>
            {error instanceof Error ? error.message : "Unknown error"}
          </Text>
        </View>
      </View>
    );
  }

  // Empty state
  if (!recordings || recordings.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Ionicons name="mic-off-outline" size={64} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No Recordings Yet</Text>
          <Text style={styles.emptyText}>
            Your recorded practice sessions will appear here
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Audio Player (sticky at top) */}
      {selectedRecording && (
        <View style={styles.playerContainer}>
          <View style={styles.playerHeader}>
            <Text style={styles.playerTitle} numberOfLines={1}>
              {selectedRecording.topicTitle}
            </Text>
            <TouchableOpacity onPress={() => setSelectedRecording(null)}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <AudioPlayer uri={selectedRecording.audioUrl} />
        </View>
      )}

      {/* Recordings List */}
      <FlatList
        data={recordings}
        keyExtractor={(item) => item.id}
        renderItem={renderRecording}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={() => (
          <View style={styles.listHeader}>
            <Text style={styles.headerTitle}>Your Recordings</Text>
            <Text style={styles.headerSubtitle}>
              {recordings.length} recording{recordings.length !== 1 ? "s" : ""}
            </Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginTop: 16,
  },
  errorSubtext: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1F2937",
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },
  playerContainer: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  playerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  playerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginRight: 12,
  },
  listContent: {
    padding: 16,
  },
  listHeader: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },
  recordingCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  recordingCardActive: {
    backgroundColor: "#EEF2FF",
    borderColor: "#6366F1",
  },
  recordingHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  recordingInfo: {
    flex: 1,
    marginRight: 12,
  },
  topicTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  questionText: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  deleteButton: {
    padding: 4,
  },
  recordingMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: "#6B7280",
  },
  scoreText: {
    fontSize: 12,
    color: "#F59E0B",
    fontWeight: "600",
  },
  separator: {
    height: 12,
  },
});
