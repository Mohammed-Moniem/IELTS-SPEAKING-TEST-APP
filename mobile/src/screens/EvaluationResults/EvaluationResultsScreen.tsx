import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { saveTestResult, TestResult } from "../../api/analyticsApi";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";
import { radii, shadows, spacing } from "../../theme/tokens";
import { logger } from "../../utils/logger";

interface EvaluationCriteria {
  band: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  detailedExamples?: Array<{
    issue: string;
    yourResponse?: string;
    betterAlternative?: string;
    explanation: string;
    suggestion?: string;
  }>;
  linkingPhrases?: Array<{
    context: string;
    phrases: string[];
  }>;
  vocabularyAlternatives?: Array<{
    original: string;
    alternatives: string[];
    exampleSentence: string;
  }>;
  collocations?: Array<{
    phrase: string;
    example: string;
  }>;
}

interface Correction {
  original: string;
  corrected: string;
  explanation: string;
}

interface EvaluationResultsProps {
  overallBand: number;
  criteria: {
    fluencyCoherence: EvaluationCriteria;
    lexicalResource: EvaluationCriteria;
    grammaticalRange: EvaluationCriteria;
    pronunciation: EvaluationCriteria;
  };
  corrections: Correction[];
  suggestions: string[];
  bandComparison?: {
    currentBandLabel?: string;
    currentBandCharacteristics: string[];
    nextBandLabel?: string;
    nextBandCharacteristics: string[];
    nextBandExample?: {
      band: number;
      title?: string;
      response: string;
      highlights?: string[];
    };
    band9Example: string;
  };
  onClose: () => void;
  onTryAgain?: () => void;
  // Analytics integration props
  userId?: string;
  sessionId?: string;
  testType?: "practice" | "simulation" | "local";
  topic?: string;
  testPart?: string;
  durationSeconds?: number;
  audioRecordingId?: string;
  // Control button visibility
  showTryAgain?: boolean;
}

export const EvaluationResultsScreen: React.FC<EvaluationResultsProps> = ({
  overallBand,
  criteria,
  corrections,
  suggestions,
  bandComparison,
  onClose,
  onTryAgain,
  userId,
  sessionId,
  testType = "practice",
  topic,
  testPart,
  durationSeconds,
  audioRecordingId,
  showTryAgain = true,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Auto-save test result to analytics
  useEffect(() => {
    const saveResult = async () => {
      if (!userId || !sessionId || !topic || saved) return;

      setSaving(true);
      try {
        const testData: TestResult = {
          userId,
          sessionId,
          testType: testType === "local" ? "practice" : testType,
          topic,
          testPart,
          durationSeconds: durationSeconds || 0,
          overallBand,
          criteria: {
            fluencyCoherence: {
              band: criteria.fluencyCoherence.band,
              feedback: criteria.fluencyCoherence.feedback,
              strengths: criteria.fluencyCoherence.strengths,
              improvements: criteria.fluencyCoherence.improvements,
            },
            lexicalResource: {
              band: criteria.lexicalResource.band,
              feedback: criteria.lexicalResource.feedback,
              strengths: criteria.lexicalResource.strengths,
              improvements: criteria.lexicalResource.improvements,
            },
            grammaticalRange: {
              band: criteria.grammaticalRange.band,
              feedback: criteria.grammaticalRange.feedback,
              strengths: criteria.grammaticalRange.strengths,
              improvements: criteria.grammaticalRange.improvements,
            },
            pronunciation: {
              band: criteria.pronunciation.band,
              feedback: criteria.pronunciation.feedback,
              strengths: criteria.pronunciation.strengths,
              improvements: criteria.pronunciation.improvements,
            },
          },
          corrections,
          suggestions,
          audioRecordingId,
        };

        const testId = await saveTestResult(testData);
        if (testId) {
          console.log("✅ Test result saved to analytics:", testId);
          setSaved(true);
        }
      } catch (error) {
        logger.warn("Failed to save test result", error);
      } finally {
        setSaving(false);
      }
    };

    saveResult();
  }, [sessionId, topic, saved, userId]);

  const getBandColor = (band: number): string => {
    if (band >= 8) return colors.success;
    if (band >= 7) return colors.info;
    if (band >= 6) return colors.warning;
    if (band >= 5) return colors.danger;
    return colors.textMuted;
  };

  const getBandLabel = (band: number): string => {
    if (band >= 8) return "Excellent";
    if (band >= 7) return "Good";
    if (band >= 6) return "Competent";
    if (band >= 5) return "Modest";
    return "Limited";
  };

  const resolveHeading = (label: string | undefined, fallback: string) => {
    if (label && label.trim().length > 0) {
      return label.trim();
    }
    return fallback;
  };

  const correctionsList = Array.isArray(corrections) ? corrections : [];
  const suggestionsList = Array.isArray(suggestions) ? suggestions : [];

  const renderCriteriaCard = (title: string, data: EvaluationCriteria) => {
    const strengths = Array.isArray(data.strengths) ? data.strengths : [];
    const improvements = Array.isArray(data.improvements)
      ? data.improvements
      : [];
    const detailedExamples = Array.isArray(data.detailedExamples)
      ? data.detailedExamples
      : [];
    const linkingGroups = Array.isArray(data.linkingPhrases)
      ? data.linkingPhrases
      : [];
    const vocabularyAlternatives = Array.isArray(data.vocabularyAlternatives)
      ? data.vocabularyAlternatives
      : [];
    const collocations = Array.isArray(data.collocations)
      ? data.collocations
      : [];

    return (
      <View style={styles.criteriaCard}>
        <View style={styles.criteriaHeader}>
          <Text style={styles.criteriaTitle}>{title}</Text>
          <View
            style={[
              styles.bandBadge,
              { backgroundColor: getBandColor(data.band || 0) },
            ]}
          >
            <Text style={styles.bandBadgeText}>
              {(data.band || 0).toFixed(1)}
            </Text>
          </View>
        </View>

        <Text style={styles.feedbackText}>{data.feedback}</Text>

        {strengths.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.sectionTitle}>Strengths</Text>
            </View>
            {strengths.map((strength, index) => (
              <Text key={index} style={styles.bulletPoint}>
                • {strength}
              </Text>
            ))}
          </View>
        )}

        {improvements.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="trending-up" size={20} color={colors.warning} />
              <Text style={styles.sectionTitle}>Areas to Improve</Text>
            </View>
            {improvements.map((improvement, index) => (
              <Text key={index} style={styles.bulletPoint}>
                • {improvement}
              </Text>
            ))}
          </View>
        )}

        {/* Detailed Examples */}
        {detailedExamples.length > 0 && (
          <View style={styles.detailedSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bulb" size={20} color={colors.warning} />
              <Text style={styles.sectionTitle}>Detailed Examples</Text>
            </View>
            {detailedExamples.map((example, index) => (
              <View key={index} style={styles.exampleCard}>
                <Text style={styles.exampleIssue}>
                  <Text style={styles.boldText}>Issue:</Text> {example.issue}
                </Text>
                {example.yourResponse && (
                  <Text style={styles.yourResponse}>
                    <Text style={styles.boldText}>Your response:</Text> "
                    {example.yourResponse}"
                  </Text>
                )}
                {example.betterAlternative && (
                  <Text style={styles.betterAlternative}>
                    <Text style={styles.boldText}>Better alternative:</Text> "
                    {example.betterAlternative}"
                  </Text>
                )}
                <Text style={styles.exampleExplanation}>
                  <Text style={styles.boldText}>Why:</Text>{" "}
                  {example.explanation}
                </Text>
                {example.suggestion && (
                  <Text style={styles.exampleSuggestion}>
                    💡 {example.suggestion}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Vocabulary Alternatives */}
        {vocabularyAlternatives.length > 0 && (
          <View style={styles.detailedSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="book" size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Vocabulary Alternatives</Text>
            </View>
            {vocabularyAlternatives.map((vocab, index) => (
              <View key={index} style={styles.vocabCard}>
                <Text style={styles.vocabOriginal}>
                  Instead of:{" "}
                  <Text style={styles.highlightedWord}>{vocab.original}</Text>
                </Text>
                <Text style={styles.vocabAlternatives}>
                  Try:{" "}
                  {vocab.alternatives.map((alt, i) => (
                    <Text key={i}>
                      <Text style={styles.highlightedWord}>{alt}</Text>
                      {i < vocab.alternatives.length - 1 ? ", " : ""}
                    </Text>
                  ))}
                </Text>
                <Text style={styles.vocabExample}>
                  <Text style={styles.boldText}>Example:</Text>{" "}
                  {vocab.exampleSentence}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Collocations */}
        {collocations.length > 0 && (
          <View style={styles.detailedSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="link" size={20} color={colors.success} />
              <Text style={styles.sectionTitle}>Useful Collocations</Text>
            </View>
            {collocations.map((collocation, index) => (
              <View key={index} style={styles.collocationCard}>
                <Text style={styles.collocationPhrase}>
                  {collocation.phrase}
                </Text>
                <Text style={styles.collocationExample}>
                  "{collocation.example}"
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Linking Phrases */}
        {linkingGroups.length > 0 && (
          <View style={styles.detailedSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="git-branch" size={20} color={colors.info} />
              <Text style={styles.sectionTitle}>Linking Phrases</Text>
            </View>
            {linkingGroups.map((group, index) => (
              <View key={index} style={styles.linkingGroup}>
                <Text style={styles.linkingContext}>{group.context}:</Text>
                <View style={styles.phrasesContainer}>
                  {group.phrases.map((phrase, pIndex) => (
                    <View key={pIndex} style={styles.phraseChip}>
                      <Text style={styles.phraseText}>{phrase}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Your Results</Text>
          {saving && (
            <View style={styles.savingIndicator}>
              <ActivityIndicator size="small" color={colors.warning} />
              <Text style={styles.savingText}>Saving...</Text>
            </View>
          )}
          {saved && !saving && (
            <View style={styles.savedIndicator}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={colors.success}
              />
              <Text style={styles.savedText}>Saved to history</Text>
            </View>
          )}
        </View>
        <View style={styles.closeButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Overall Band Score */}
        <View style={styles.overallCard}>
          <Text style={styles.overallLabel}>Overall Band Score</Text>
          <View style={styles.overallScoreContainer}>
            <Text style={styles.overallScore}>{overallBand.toFixed(1)}</Text>
            <View style={styles.bandLabelContainer}>
              <Text style={styles.bandLabelText}>
                {getBandLabel(overallBand)}
              </Text>
              <Text style={styles.outOf9}>out of 9</Text>
            </View>
          </View>
        </View>

        {/* Criteria Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionMainTitle}>Detailed Breakdown</Text>

          {renderCriteriaCard("Fluency & Coherence", criteria.fluencyCoherence)}
          {renderCriteriaCard("Lexical Resource", criteria.lexicalResource)}
          {renderCriteriaCard("Grammatical Range", criteria.grammaticalRange)}
          {renderCriteriaCard("Pronunciation", criteria.pronunciation)}
        </View>

        {/* Corrections */}
        {correctionsList.length > 0 && (
          <View style={styles.section}>
          <View style={styles.sectionHeader}>
              <Ionicons name="warning" size={24} color={colors.danger} />
              <Text style={styles.sectionMainTitle}>Corrections</Text>
            </View>
            {correctionsList.map((correction, index) => (
              <View key={index} style={styles.correctionCard}>
                <View style={styles.correctionRow}>
                  <Text style={styles.correctionLabel}>You said:</Text>
                  <Text style={styles.correctionOriginal}>
                    {correction.original}
                  </Text>
                </View>
                <View style={styles.correctionRow}>
                  <Text style={styles.correctionLabel}>Better:</Text>
                  <Text style={styles.correctionCorrected}>
                    {correction.corrected}
                  </Text>
                </View>
                <Text style={styles.correctionExplanation}>
                  {correction.explanation}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Suggestions */}
        {suggestionsList.length > 0 && (
          <View style={styles.section}>
          <View style={styles.sectionHeader}>
              <Ionicons name="bulb" size={24} color={colors.warning} />
              <Text style={styles.sectionMainTitle}>Tips for Improvement</Text>
            </View>
            {suggestionsList.map((suggestion, index) => (
              <View key={index} style={styles.suggestionCard}>
                <Text style={styles.suggestionText}>
                  {index + 1}. {suggestion}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Band Comparison */}
        {bandComparison && (
          <View style={styles.section}>
            <Text style={styles.sectionMainTitle}>Band Level Comparison</Text>

            <View style={styles.bandComparisonCard}>
              <Text style={styles.bandComparisonTitle}>
                {resolveHeading(
                  bandComparison.currentBandLabel,
                  "Your Current Band Level"
                )}
              </Text>
              {bandComparison.currentBandCharacteristics.map((char, index) => (
                <Text key={index} style={styles.bandCharacteristic}>
                  • {char}
                </Text>
              ))}
            </View>

            <View style={styles.bandComparisonCard}>
              <Text style={styles.bandComparisonTitle}>
                {resolveHeading(
                  bandComparison.nextBandLabel,
                  "Next Band Level (What you need)"
                )}
              </Text>
              {bandComparison.nextBandCharacteristics.map((char, index) => (
                <Text key={index} style={styles.bandCharacteristic}>
                  • {char}
                </Text>
              ))}
            </View>

            {bandComparison.nextBandExample?.response &&
              (() => {
                const example = bandComparison.nextBandExample;
                const bandLabel = example.band
                  ? `Band ${example.band.toFixed(1)}`
                  : "Next Band Example";
                const titleSuffix = example.title ? ` – ${example.title}` : "";

                return (
                  <View style={styles.bandComparisonCard}>
                    <Text style={styles.bandComparisonTitle}>
                      {`${bandLabel} Sample Response${titleSuffix}`}
                    </Text>
                    <View style={styles.bandExampleBody}>
                      <Text style={styles.bandExampleLabel}>{bandLabel}</Text>
                      <Text style={styles.bandExampleResponse}>
                        {example.response}
                      </Text>

                      {example.highlights && example.highlights.length > 0 && (
                        <View style={styles.bandExampleHighlights}>
                          {example.highlights.map((highlight, index) => (
                            <Text
                              key={index}
                              style={styles.bandExampleHighlight}
                            >
                              • {highlight}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })()}

            {bandComparison.band9Example && (
              <View style={styles.bandComparisonCard}>
                <Text style={styles.bandComparisonTitle}>
                  Band 9 Example Response
                </Text>
                <View
                  style={[
                    styles.bandExampleBody,
                    styles.bandExampleBodySuccess,
                  ]}
                >
                  <Text
                    style={[
                      styles.bandExampleLabel,
                      styles.bandExampleLabelSuccess,
                    ]}
                  >
                    Band 9
                  </Text>
                  <Text style={styles.bandExampleResponse}>
                    {bandComparison.band9Example}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {showTryAgain && onTryAgain && (
            <TouchableOpacity
              style={styles.tryAgainButton}
              onPress={onTryAgain}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={20} color={colors.primaryOn} />
              <Text style={styles.tryAgainText}>Try Again</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.doneButton,
              (!showTryAgain || !onTryAgain) && styles.doneButtonFull,
            ]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.backgroundMuted,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  savingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  savingText: {
    fontSize: 11,
    color: colors.warning,
  },
  savedIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  savedText: {
    fontSize: 11,
    color: colors.success,
  },
  scrollView: {
    flex: 1,
  },
  overallCard: {
    margin: spacing.lg,
    padding: spacing.xxl,
    borderRadius: radii.xl,
    alignItems: "center",
    backgroundColor: colors.primary,
    ...shadows.card,
  },
  overallLabel: {
    fontSize: 16,
    color: colors.primaryOn,
    fontWeight: "600",
    marginBottom: 15,
    opacity: 0.9,
  },
  overallScoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  overallScore: {
    fontSize: 72,
    fontWeight: "bold",
    color: colors.primaryOn,
  },
  bandLabelContainer: {
    alignItems: "flex-start",
  },
  bandLabelText: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.primaryOn,
  },
  outOf9: {
    fontSize: 14,
    color: colors.primaryOn,
    opacity: 0.8,
  },
  section: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionMainTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 15,
    marginLeft: 5,
  },
  criteriaCard: {
    backgroundColor: colors.backgroundMuted,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  criteriaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  criteriaTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  bandBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  bandBadgeText: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.primaryOn,
  },
  feedbackText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 15,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  bulletPoint: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginLeft: 10,
    marginBottom: 8,
  },
  correctionCard: {
    backgroundColor: colors.backgroundMuted,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    ...shadows.card,
  },
  correctionRow: {
    marginBottom: 8,
  },
  correctionLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  correctionOriginal: {
    fontSize: 14,
    color: colors.danger,
    fontStyle: "italic",
  },
  correctionCorrected: {
    fontSize: 14,
    color: colors.success,
    fontWeight: "600",
  },
  correctionExplanation: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
    lineHeight: 20,
  },
  suggestionCard: {
    backgroundColor: colors.backgroundMuted,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    ...shadows.card,
  },
  suggestionText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: spacing.lg,
    marginTop: 10,
  },
  tryAgainButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    gap: 8,
    ...shadows.card,
  },
  tryAgainText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primaryOn,
  },
  doneButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.backgroundMuted,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  doneButtonFull: {
    flex: 1,
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  doneText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  // New detailed feedback styles
  detailedSection: {
    marginTop: spacing.md,
  },
  exampleCard: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  exampleIssue: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  yourResponse: {
    fontSize: 14,
    color: colors.danger,
    marginBottom: spacing.xs,
    fontStyle: "italic",
    lineHeight: 20,
  },
  betterAlternative: {
    fontSize: 14,
    color: colors.success,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  exampleExplanation: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  exampleSuggestion: {
    fontSize: 13,
    color: colors.info,
    marginTop: spacing.xs,
    lineHeight: 19,
  },
  boldText: {
    fontWeight: "600",
    color: colors.textPrimary,
  },
  vocabCard: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  vocabOriginal: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  vocabAlternatives: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  highlightedWord: {
    fontWeight: "600",
    color: colors.primary,
  },
  vocabExample: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: "italic",
    lineHeight: 19,
  },
  collocationCard: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  collocationPhrase: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.success,
    marginBottom: spacing.xs,
  },
  collocationExample: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
  linkingGroup: {
    marginBottom: spacing.md,
  },
  linkingContext: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  phrasesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  phraseChip: {
    backgroundColor: colors.info + "20",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.info,
  },
  phraseText: {
    fontSize: 13,
    color: colors.info,
    fontWeight: "500",
  },
  bandComparisonCard: {
    backgroundColor: colors.backgroundMuted,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  bandComparisonTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  bandCharacteristic: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xs,
  },
  bandExampleBody: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  bandExampleBodySuccess: {
    borderLeftColor: colors.success,
  },
  bandExampleLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bandExampleLabelSuccess: {
    color: colors.success,
  },
  bandExampleResponse: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 22,
    fontStyle: "italic",
  },
  bandExampleHighlights: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  bandExampleHighlight: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xs,
  },
});
