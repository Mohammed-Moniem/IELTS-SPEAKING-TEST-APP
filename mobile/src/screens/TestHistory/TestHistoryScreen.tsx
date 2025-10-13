/**
 * Test History Screen
 * Displays all past tests with filters and pagination
 */

import { Ionicons } from "@expo/vector-icons";
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
import {
  deleteTest,
  getTestHistory,
  TestHistory,
} from "../../api/analyticsApi";

const DEMO_USER_ID = "demo-user-123";
const PAGE_SIZE = 20;

type TestType = "all" | "practice" | "simulation";
type SortBy = "date-desc" | "date-asc" | "score-desc" | "score-asc";

export const TestHistoryScreen: React.FC = () => {
  const [tests, setTests] = useState<TestHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<TestType>("all");
  const [sortBy, setSortBy] = useState<SortBy>("date-desc");
  const [skip, setSkip] = useState(0);

  useEffect(() => {
    loadTests(true);
  }, [filter, sortBy]);

  const loadTests = async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setSkip(0);
      } else {
        setLoadingMore(true);
      }

      const newSkip = reset ? 0 : skip;
      const testType = filter === "all" ? undefined : filter;

      const response = await getTestHistory(DEMO_USER_ID, {
        limit: PAGE_SIZE,
        skip: newSkip,
        testType,
      });

      // Apply client-side sorting
      const sorted = sortTests(response.tests);

      if (reset) {
        setTests(sorted);
      } else {
        setTests((prev) => [...prev, ...sorted]);
      }

      setHasMore(response.tests.length === PAGE_SIZE);
      setSkip(newSkip + response.tests.length);
    } catch (error) {
      console.error("Failed to load tests:", error);
      Alert.alert("Error", "Failed to load test history");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const sortTests = (data: TestHistory[]): TestHistory[] => {
    return [...data].sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return (
            new Date(b.completedAt).getTime() -
            new Date(a.completedAt).getTime()
          );
        case "date-asc":
          return (
            new Date(a.completedAt).getTime() -
            new Date(b.completedAt).getTime()
          );
        case "score-desc":
          return b.overallBand - a.overallBand;
        case "score-asc":
          return a.overallBand - b.overallBand;
        default:
          return 0;
      }
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTests(true);
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadTests(false);
    }
  };

  const handleDelete = (testId: string) => {
    Alert.alert(
      "Delete Test",
      "Are you sure you want to delete this test result?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTest(testId);
              setTests((prev) => prev.filter((t) => t._id !== testId));
            } catch (error) {
              Alert.alert("Error", "Failed to delete test");
            }
          },
        },
      ]
    );
  };

  const getBandColor = (band: number): string => {
    if (band >= 8) return "#10b981";
    if (band >= 7) return "#3b82f6";
    if (band >= 6) return "#f59e0b";
    return "#ef4444";
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderTestCard = (test: TestHistory) => {
    return (
      <View key={test._id} style={styles.testCard}>
        {/* Header */}
        <View style={styles.testHeader}>
          <View style={styles.testTypeContainer}>
            <View
              style={[
                styles.testTypeBadge,
                test.testType === "practice"
                  ? styles.practiceBadge
                  : styles.simulationBadge,
              ]}
            >
              <Ionicons
                name={test.testType === "practice" ? "school" : "trophy"}
                size={14}
                color="#ffffff"
              />
              <Text style={styles.testTypeText}>
                {test.testType === "practice" ? "Practice" : "Simulation"}
              </Text>
            </View>
            {test.testPart && (
              <Text style={styles.testPart}>Part {test.testPart}</Text>
            )}
          </View>

          <TouchableOpacity
            onPress={() => handleDelete(test._id)}
            style={styles.deleteButton}
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>

        {/* Topic */}
        <Text style={styles.testTopic}>{test.topic}</Text>

        {/* Metadata */}
        <View style={styles.testMetadata}>
          <View style={styles.metadataItem}>
            <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
            <Text style={styles.metadataText}>
              {formatDate(test.completedAt)}
            </Text>
          </View>
          <View style={styles.metadataItem}>
            <Ionicons name="time-outline" size={14} color="#9ca3af" />
            <Text style={styles.metadataText}>
              {formatTime(test.completedAt)}
            </Text>
          </View>
          <View style={styles.metadataItem}>
            <Ionicons name="stopwatch-outline" size={14} color="#9ca3af" />
            <Text style={styles.metadataText}>
              {formatDuration(test.durationSeconds)}
            </Text>
          </View>
        </View>

        {/* Band Score */}
        <View style={styles.bandContainer}>
          <View
            style={[
              styles.bandBadge,
              { backgroundColor: getBandColor(test.overallBand) },
            ]}
          >
            <Text style={styles.bandScore}>{test.overallBand.toFixed(1)}</Text>
            <Text style={styles.bandLabel}>Band</Text>
          </View>

          {/* Criteria Scores */}
          <View style={styles.criteriaGrid}>
            {[
              { key: "fluencyCoherence", label: "FC" },
              { key: "lexicalResource", label: "LR" },
              { key: "grammaticalRange", label: "GR" },
              { key: "pronunciation", label: "PR" },
            ].map((criterion) => {
              const score =
                test.criteria[criterion.key as keyof typeof test.criteria];
              return (
                <View key={criterion.key} style={styles.criteriaItem}>
                  <Text style={styles.criteriaLabel}>{criterion.label}</Text>
                  <Text
                    style={[
                      styles.criteriaScore,
                      { color: getBandColor(score.band) },
                    ]}
                  >
                    {score.band.toFixed(1)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Audio Recording Indicator */}
        {test.audioRecordingId && (
          <View style={styles.audioIndicator}>
            <Ionicons name="musical-notes" size={12} color="#3b82f6" />
            <Text style={styles.audioText}>Audio recording available</Text>
          </View>
        )}
      </View>
    );
  };

  const renderFilters = () => {
    return (
      <View style={styles.filtersContainer}>
        {/* Type Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterTabs}
        >
          {(["all", "practice", "simulation"] as TestType[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterTab,
                filter === type && styles.filterTabActive,
              ]}
              onPress={() => setFilter(type)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filter === type && styles.filterTabTextActive,
                ]}
              >
                {type === "all"
                  ? "All"
                  : type === "practice"
                  ? "Practice"
                  : "Simulation"}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Sort */}
        <View style={styles.sortContainer}>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => {
              const options: SortBy[] = [
                "date-desc",
                "date-asc",
                "score-desc",
                "score-asc",
              ];
              const currentIndex = options.indexOf(sortBy);
              const nextIndex = (currentIndex + 1) % options.length;
              setSortBy(options[nextIndex]);
            }}
          >
            <Ionicons name="funnel-outline" size={16} color="#ffffff" />
            <Text style={styles.sortText}>
              {sortBy === "date-desc"
                ? "Newest"
                : sortBy === "date-asc"
                ? "Oldest"
                : sortBy === "score-desc"
                ? "Highest"
                : "Lowest"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#1a365d", "#2d5a8f"]} style={styles.header}>
          <Text style={styles.headerTitle}>Test History</Text>
        </LinearGradient>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading tests...</Text>
        </View>
      </View>
    );
  }

  if (tests.length === 0) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#1a365d", "#2d5a8f"]} style={styles.header}>
          <Text style={styles.headerTitle}>Test History</Text>
        </LinearGradient>
        <View style={styles.centerContainer}>
          <Ionicons name="document-text-outline" size={64} color="#4b5563" />
          <Text style={styles.emptyTitle}>No Tests Yet</Text>
          <Text style={styles.emptySubtitle}>
            Complete some tests to see your history
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#1a365d", "#2d5a8f"]} style={styles.header}>
        <Text style={styles.headerTitle}>Test History</Text>
        <Text style={styles.headerSubtitle}>
          {tests.length} test{tests.length !== 1 ? "s" : ""}
        </Text>
      </LinearGradient>

      {/* Filters */}
      {renderFilters()}

      {/* Test List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#3b82f6"
          />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const isCloseToBottom =
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - 100;
          if (isCloseToBottom) {
            handleLoadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        {tests.map(renderTestCard)}

        {loadingMore && (
          <View style={styles.loadingMore}>
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text style={styles.loadingMoreText}>Loading more...</Text>
          </View>
        )}

        {!hasMore && tests.length > 0 && (
          <Text style={styles.endText}>That's all your tests!</Text>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#d4a745",
  },
  filtersContainer: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#2d2d2d",
  },
  filterTabs: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
  },
  filterTabActive: {
    backgroundColor: "#3b82f6",
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9ca3af",
  },
  filterTabTextActive: {
    color: "#ffffff",
  },
  sortContainer: {
    paddingHorizontal: 20,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  sortText: {
    fontSize: 12,
    color: "#d1d5db",
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  testCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2d2d2d",
  },
  testHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  testTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  testTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  practiceBadge: {
    backgroundColor: "#3b82f6",
  },
  simulationBadge: {
    backgroundColor: "#d4a745",
  },
  testTypeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
  },
  testPart: {
    fontSize: 12,
    color: "#9ca3af",
  },
  deleteButton: {
    padding: 5,
  },
  testTopic: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 10,
  },
  testMetadata: {
    flexDirection: "row",
    gap: 15,
    marginBottom: 15,
  },
  metadataItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metadataText: {
    fontSize: 12,
    color: "#9ca3af",
  },
  bandContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  bandBadge: {
    width: 70,
    height: 70,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  bandScore: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
  },
  bandLabel: {
    fontSize: 10,
    color: "#ffffff",
    opacity: 0.8,
  },
  criteriaGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  criteriaItem: {
    alignItems: "center",
    width: "22%",
  },
  criteriaLabel: {
    fontSize: 10,
    color: "#9ca3af",
    marginBottom: 3,
  },
  criteriaScore: {
    fontSize: 14,
    fontWeight: "bold",
  },
  audioIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#2d2d2d",
  },
  audioText: {
    fontSize: 11,
    color: "#3b82f6",
  },
  loadingMore: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingVertical: 20,
  },
  loadingMoreText: {
    fontSize: 14,
    color: "#9ca3af",
  },
  endText: {
    textAlign: "center",
    fontSize: 14,
    color: "#6b7280",
    paddingVertical: 20,
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
    color: "#9ca3af",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
});
