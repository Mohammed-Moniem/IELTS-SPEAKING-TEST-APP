import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { practiceApi, simulationApi } from "../../api/services";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionHeading } from "../../components/SectionHeading";
import {
  resultsStorage,
  PracticeResult as StoredResult,
} from "../../services/resultsStorage";
import { colors, spacing } from "../../theme/tokens";
import { EvaluationResultsScreen } from "../EvaluationResults/EvaluationResultsScreen";

type TabType = "local" | "practice" | "simulation";
type FilterType = "all" | "completed" | "in-progress";
type SortType = "date-desc" | "date-asc" | "score-desc" | "score-asc";

interface PracticeResult {
  _id: string;
  topic: {
    title: string;
    slug: string;
  };
  feedback?: {
    overallBand: number;
    bandBreakdown: {
      pronunciation: number;
      fluency: number;
      lexicalResource: number;
      grammaticalRange: number;
    };
  };
  completedAt: string;
  createdAt: string;
}

interface SimulationResult {
  _id: string;
  overallBand: number;
  status: string;
  completedAt: string;
  createdAt: string;
  parts: any[];
}

export const ResultsScreen = () => {
  const [activeTab, setActiveTab] = useState<TabType>("local");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortType>("date-desc");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLocalResult, setSelectedLocalResult] = useState<
    StoredResult | null
  >(null);
  const [showLocalModal, setShowLocalModal] = useState(false);
  const navigation = useNavigation();

  // Query for local stored results
  const localResults = useQuery({
    queryKey: ["local-results"],
    queryFn: () => resultsStorage.getAllResults(),
  });

  const practiceResults = useQuery({
    queryKey: ["practice-results"],
    queryFn: () => practiceApi.listSessions({ limit: 50, offset: 0 }),
  });

  const simulationResults = useQuery({
    queryKey: ["simulation-results"],
    queryFn: () => simulationApi.list({ limit: 50, offset: 0 }),
  });

  const renderPracticeItem = ({ item }: { item: PracticeResult }) => {
    const hasCompleted = item.completedAt && item.feedback;
    const band = item.feedback?.overallBand || 0;

    return (
      <TouchableOpacity
        style={styles.resultCard}
        onPress={() => {
          if (hasCompleted) {
            // Navigate to detail screen
            (navigation as any).navigate("PracticeResultDetail", {
              sessionId: item._id,
            });
          }
        }}
        disabled={!hasCompleted}
      >
        <View style={styles.resultHeader}>
          <Text style={styles.topicTitle} numberOfLines={2}>
            {item.topic?.title || "Practice Session"}
          </Text>
          {hasCompleted && (
            <View
              style={[
                styles.bandBadge,
                { backgroundColor: getBandColor(band) },
              ]}
            >
              <Text style={styles.bandText}>{band.toFixed(1)}</Text>
            </View>
          )}
        </View>

        {hasCompleted ? (
          <View style={styles.scoresRow}>
            <ScorePill
              label="Pronunciation"
              score={item.feedback!.bandBreakdown.pronunciation}
            />
            <ScorePill
              label="Fluency"
              score={item.feedback!.bandBreakdown.fluency}
            />
            <ScorePill
              label="Vocabulary"
              score={item.feedback!.bandBreakdown.lexicalResource}
            />
            <ScorePill
              label="Grammar"
              score={item.feedback!.bandBreakdown.grammaticalRange}
            />
          </View>
        ) : (
          <Text style={styles.incompleteText}>In Progress</Text>
        )}

        <Text style={styles.dateText}>
          {new Date(item.completedAt || item.createdAt).toLocaleDateString(
            "en-US",
            {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }
          )}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderLocalResultItem = ({ item }: { item: StoredResult }) => {
    const band = item.evaluation.overallBand;

    return (
      <TouchableOpacity
        style={styles.resultCard}
        onPress={() => {
          setSelectedLocalResult(item);
          setShowLocalModal(true);
        }}
      >
        <View style={styles.resultHeader}>
          <Text style={styles.topicTitle} numberOfLines={2}>
            Part {item.part} - {item.topic}
          </Text>
          <View
            style={[styles.bandBadge, { backgroundColor: getBandColor(band) }]}
          >
            <Text style={styles.bandText}>{band.toFixed(1)}</Text>
          </View>
        </View>

        <View style={styles.scoresRow}>
          <ScorePill
            label="Fluency"
            score={item.evaluation.criteria.fluency?.score || 0}
          />
          <ScorePill
            label="Lexical"
            score={item.evaluation.criteria.lexicalResource?.score || 0}
          />
          <ScorePill
            label="Grammar"
            score={item.evaluation.criteria.grammaticalRange?.score || 0}
          />
          <ScorePill
            label="Pronunciation"
            score={item.evaluation.criteria.pronunciation?.score || 0}
          />
        </View>

        <Text style={styles.dateText}>
          {new Date(item.timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          • {Math.floor(item.duration / 60)}:
          {(item.duration % 60).toString().padStart(2, "0")}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderSimulationItem = ({ item }: { item: SimulationResult }) => {
    const hasCompleted = item.status === "completed";
    const band = item.overallBand || 0;

    return (
      <TouchableOpacity
        style={styles.resultCard}
        onPress={() => {
          if (hasCompleted) {
            (navigation as any).navigate("SimulationDetail", {
              simulationId: item._id,
            });
          }
        }}
        disabled={!hasCompleted}
      >
        <View style={styles.resultHeader}>
          <Text style={styles.topicTitle}>Full IELTS Simulation</Text>
          {hasCompleted && (
            <View
              style={[
                styles.bandBadge,
                { backgroundColor: getBandColor(band) },
              ]}
            >
              <Text style={styles.bandText}>{band.toFixed(1)}</Text>
            </View>
          )}
        </View>

        <Text style={styles.partsText}>
          {item.parts?.length || 3} Parts Completed
        </Text>

        {!hasCompleted && (
          <Text style={styles.incompleteText}>In Progress</Text>
        )}

        <Text style={styles.dateText}>
          {new Date(item.completedAt || item.createdAt).toLocaleDateString(
            "en-US",
            {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }
          )}
        </Text>
      </TouchableOpacity>
    );
  };

  const buildEvaluationCriteria = (result: StoredResult) => {
    const detailed = (result.evaluation.detailed || {}) as Record<string, any>;
    const summary = result.evaluation.criteria || {
      fluency: { score: 0, feedback: "" },
      lexicalResource: { score: 0, feedback: "" },
      grammaticalRange: { score: 0, feedback: "" },
      pronunciation: { score: 0, feedback: "" },
    };

    const buildFluency = detailed.fluencyCoherence || {
      band: summary.fluency?.score || 0,
      feedback: summary.fluency?.feedback || "",
      strengths: [],
      improvements: [],
      detailedExamples: [],
      linkingPhrases: [],
    };

    const buildLexical = detailed.lexicalResource || {
      band: summary.lexicalResource?.score || 0,
      feedback: summary.lexicalResource?.feedback || "",
      strengths: [],
      improvements: [],
      detailedExamples: [],
      vocabularyAlternatives: [],
      collocations: [],
    };

    const buildGrammar = detailed.grammaticalRange || {
      band: summary.grammaticalRange?.score || 0,
      feedback: summary.grammaticalRange?.feedback || "",
      strengths: [],
      improvements: [],
      detailedExamples: [],
    };

    const buildPronunciation = detailed.pronunciation || {
      band: summary.pronunciation?.score || 0,
      feedback: summary.pronunciation?.feedback || "",
      strengths: [],
      improvements: [],
      detailedExamples: [],
    };

    return {
      fluencyCoherence: buildFluency,
      lexicalResource: buildLexical,
      grammaticalRange: buildGrammar,
      pronunciation: buildPronunciation,
    };
  };

  const practiceData = (practiceResults.data || []) as any[];
  const simulationData = (simulationResults.data || []) as any[];

  // Filter and search logic
  const filteredPracticeData = useMemo(() => {
    let filtered = [...practiceData];

    // Apply filter
    if (filter === "completed") {
      filtered = filtered.filter((item) => item.completedAt && item.feedback);
    } else if (filter === "in-progress") {
      filtered = filtered.filter((item) => !item.completedAt || !item.feedback);
    }

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter((item) =>
        item.topic?.title?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return (
            new Date(b.completedAt || b.createdAt).getTime() -
            new Date(a.completedAt || a.createdAt).getTime()
          );
        case "date-asc":
          return (
            new Date(a.completedAt || a.createdAt).getTime() -
            new Date(b.completedAt || b.createdAt).getTime()
          );
        case "score-desc":
          return (
            (b.feedback?.overallBand || 0) - (a.feedback?.overallBand || 0)
          );
        case "score-asc":
          return (
            (a.feedback?.overallBand || 0) - (b.feedback?.overallBand || 0)
          );
        default:
          return 0;
      }
    });

    return filtered;
  }, [practiceData, filter, searchQuery, sortBy]);

  const filteredSimulationData = useMemo(() => {
    let filtered = [...simulationData];

    // Apply filter
    if (filter === "completed") {
      filtered = filtered.filter((item) => item.status === "completed");
    } else if (filter === "in-progress") {
      filtered = filtered.filter((item) => item.status !== "completed");
    }

    // Apply sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return (
            new Date(b.completedAt || b.createdAt).getTime() -
            new Date(a.completedAt || a.createdAt).getTime()
          );
        case "date-asc":
          return (
            new Date(a.completedAt || a.createdAt).getTime() -
            new Date(b.completedAt || b.createdAt).getTime()
          );
        case "score-desc":
          return (b.overallBand || 0) - (a.overallBand || 0);
        case "score-asc":
          return (a.overallBand || 0) - (b.overallBand || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [simulationData, filter, sortBy]);

  const isLoading =
    activeTab === "local"
      ? localResults.isLoading
      : activeTab === "practice"
      ? practiceResults.isLoading
      : simulationResults.isLoading;

  const localData = (localResults.data || []) as StoredResult[];

  return (
    <>
      <ScreenContainer>
      <SectionHeading title="Your Results">
        Track your progress and review past evaluations
      </SectionHeading>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "local" && styles.activeTab]}
          onPress={() => setActiveTab("local")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "local" && styles.activeTabText,
            ]}
          >
            Local
          </Text>
          {localData.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{localData.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "practice" && styles.activeTab]}
          onPress={() => setActiveTab("practice")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "practice" && styles.activeTabText,
            ]}
          >
            Practice
          </Text>
          {practiceData.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{practiceData.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "simulation" && styles.activeTab]}
          onPress={() => setActiveTab("simulation")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "simulation" && styles.activeTabText,
            ]}
          >
            Simulations
          </Text>
          {simulationData.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{simulationData.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search Bar (only for practice) */}
      {activeTab === "practice" && (
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color={colors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by topic..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Filter and Sort Controls */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={colors.textPrimary}
          />
          <Text style={styles.filterButtonText}>Filters</Text>
        </TouchableOpacity>

        <View style={styles.sortContainer}>
          <Text style={styles.sortLabel}>Sort:</Text>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() =>
              setSortBy((prev) =>
                prev === "date-desc"
                  ? "date-asc"
                  : prev === "date-asc"
                  ? "score-desc"
                  : prev === "score-desc"
                  ? "score-asc"
                  : "date-desc"
              )
            }
          >
            <Text style={styles.sortButtonText}>
              {sortBy === "date-desc"
                ? "Newest first"
                : sortBy === "date-asc"
                ? "Oldest first"
                : sortBy === "score-desc"
                ? "Highest score"
                : "Lowest score"}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Chips */}
      {showFilters && (
        <View style={styles.filterChips}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              filter === "all" && styles.filterChipActive,
            ]}
            onPress={() => setFilter("all")}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === "all" && styles.filterChipTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterChip,
              filter === "completed" && styles.filterChipActive,
            ]}
            onPress={() => setFilter("completed")}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === "completed" && styles.filterChipTextActive,
              ]}
            >
              Completed
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterChip,
              filter === "in-progress" && styles.filterChipActive,
            ]}
            onPress={() => setFilter("in-progress")}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === "in-progress" && styles.filterChipTextActive,
              ]}
            >
              In Progress
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : activeTab === "local" ? (
        localData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No local results yet</Text>
            <Text style={styles.emptyText}>
              Complete a Voice AI practice session to see your results here
            </Text>
          </View>
        ) : (
          <FlatList
            data={localData}
            renderItem={renderLocalResultItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : activeTab === "practice" ? (
        filteredPracticeData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>
              {searchQuery || filter !== "all"
                ? "No results found"
                : "No results yet"}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery || filter !== "all"
                ? "Try adjusting your search or filters"
                : "Complete a practice session to see your results here"}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredPracticeData}
            renderItem={renderPracticeItem}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : filteredSimulationData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>
            {filter !== "all" ? "No results found" : "No results yet"}
          </Text>
          <Text style={styles.emptyText}>
            {filter !== "all"
              ? "Try adjusting your filters"
              : "Complete a simulation to see your results here"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredSimulationData}
          renderItem={renderSimulationItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
      </ScreenContainer>

      <Modal
      visible={showLocalModal && !!selectedLocalResult}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => {
        setShowLocalModal(false);
        setSelectedLocalResult(null);
      }}
    >
      {selectedLocalResult && (
        <EvaluationResultsScreen
          overallBand={selectedLocalResult.evaluation.overallBand}
          criteria={buildEvaluationCriteria(selectedLocalResult)}
          corrections={selectedLocalResult.evaluation.corrections}
          suggestions={selectedLocalResult.evaluation.suggestions || []}
          bandComparison={selectedLocalResult.evaluation.bandComparison}
          onClose={() => {
            setShowLocalModal(false);
            setSelectedLocalResult(null);
          }}
          onTryAgain={() => {
            setShowLocalModal(false);
            setSelectedLocalResult(null);
          }}
          testType="practice"
          topic={selectedLocalResult.topic}
          testPart={`Part ${selectedLocalResult.part}`}
          durationSeconds={selectedLocalResult.duration}
        />
      )}
    </Modal>
    </>
  );
};

const ScorePill = ({ label, score }: { label: string; score: number }) => (
  <View style={styles.scorePill}>
    <Text style={styles.scorePillLabel}>{label}</Text>
    <Text style={styles.scorePillValue}>{score.toFixed(1)}</Text>
  </View>
);

const getBandColor = (band: number): string => {
  if (band >= 8) return "#10B981"; // Green
  if (band >= 7) return "#3B82F6"; // Blue
  if (band >= 6) return "#F59E0B"; // Orange
  if (band >= 5) return "#EF4444"; // Red
  return "#6B7280"; // Gray
};

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 4,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  badge: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: spacing.xs,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    gap: spacing.xs,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  sortContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  sortLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    gap: spacing.xs,
  },
  sortButtonText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  filterChips: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  resultCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  topicTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  bandBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 44,
  },
  bandText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  scoresRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  scorePill: {
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  scorePillLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  scorePillValue: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  partsText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  incompleteText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginBottom: spacing.xs,
  },
  dateText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: spacing.xl * 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: spacing.xl * 2,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
