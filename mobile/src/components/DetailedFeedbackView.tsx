import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "../context";
import { useThemedStyles } from "../hooks";
import type { ColorTokens } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { PracticeFeedback } from "../types/api";
import { Card } from "./Card";
import { Tag } from "./Tag";

interface DetailedFeedbackViewProps {
  feedback: PracticeFeedback;
}

interface AccordionSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({
  title,
  children,
  defaultExpanded = false,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <View style={styles.accordionContainer}>
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.accordionTitle}>{title}</Text>
        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
      {isExpanded && <View style={styles.accordionContent}>{children}</View>}
    </View>
  );
};

export const DetailedFeedbackView: React.FC<DetailedFeedbackViewProps> = ({
  feedback,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const getBandColor = (band?: number) => {
    if (!band) return colors.textMuted;
    if (band >= 8) return colors.success;
    if (band >= 7) return colors.info;
    if (band >= 6) return colors.warning;
    return colors.danger;
  };

  const getBandTone = (
    band?: number
  ): "success" | "info" | "warning" | "default" => {
    if (!band) return "default";
    if (band >= 7) return "success";
    if (band >= 6) return "info";
    return "warning";
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Overall Score Card */}
      <Card style={styles.scoreCard}>
        <Text style={styles.sectionLabel}>Overall Band Score</Text>
        <View style={styles.overallScoreContainer}>
          <Text
            style={[
              styles.overallScore,
              { color: getBandColor(feedback.overallBand) },
            ]}
          >
            {feedback.overallBand?.toFixed(1) || "N/A"}
          </Text>
          <Text style={styles.outOf}>/ 9.0</Text>
        </View>

        {/* Band Breakdown */}
        {feedback.bandBreakdown && (
          <View style={styles.bandBreakdownContainer}>
            <View style={styles.bandRow}>
              <Text style={styles.bandLabel}>Pronunciation</Text>
              <Tag
                label={
                  feedback.bandBreakdown.pronunciation?.toString() || "N/A"
                }
                tone={getBandTone(feedback.bandBreakdown.pronunciation)}
              />
            </View>
            <View style={styles.bandRow}>
              <Text style={styles.bandLabel}>Fluency</Text>
              <Tag
                label={feedback.bandBreakdown.fluency?.toString() || "N/A"}
                tone={getBandTone(feedback.bandBreakdown.fluency)}
              />
            </View>
            <View style={styles.bandRow}>
              <Text style={styles.bandLabel}>Vocabulary</Text>
              <Tag
                label={
                  feedback.bandBreakdown.lexicalResource?.toString() || "N/A"
                }
                tone={getBandTone(feedback.bandBreakdown.lexicalResource)}
              />
            </View>
            <View style={styles.bandRow}>
              <Text style={styles.bandLabel}>Grammar</Text>
              <Tag
                label={
                  feedback.bandBreakdown.grammaticalRange?.toString() || "N/A"
                }
                tone={getBandTone(feedback.bandBreakdown.grammaticalRange)}
              />
            </View>
          </View>
        )}
      </Card>

      {/* Summary */}
      {feedback.summary && (
        <Card>
          <Text style={styles.sectionLabel}>Summary</Text>
          <Text style={styles.summaryText}>{feedback.summary}</Text>
        </Card>
      )}

      {/* Strengths */}
      {feedback.strengths && feedback.strengths.length > 0 && (
        <Card>
          <Text style={styles.sectionLabel}>✅ Strengths</Text>
          {feedback.strengths.map((strength, index) => (
            <View key={index} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{strength}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* Improvements */}
      {feedback.improvements && feedback.improvements.length > 0 && (
        <Card>
          <Text style={styles.sectionLabel}>💡 Areas for Improvement</Text>
          {feedback.improvements.map((improvement, index) => (
            <View key={index} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{improvement}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* Extended Analysis - Fluency */}
      {feedback.fluencyAnalysis && (
        <Card>
          <AccordionSection title="🗣️ Fluency Analysis" defaultExpanded={false}>
            <View style={styles.analysisRow}>
              <Text style={styles.metricLabel}>Speech Rate:</Text>
              <Text style={styles.metricValue}>
                {feedback.fluencyAnalysis.speechRate} wpm
              </Text>
            </View>
            <View style={styles.analysisRow}>
              <Text style={styles.metricLabel}>Pauses:</Text>
              <Text style={styles.metricValue}>
                {feedback.fluencyAnalysis.pauseCount} (avg:{" "}
                {feedback.fluencyAnalysis.avgPauseLength.toFixed(1)}s)
              </Text>
            </View>
            <View style={styles.analysisRow}>
              <Text style={styles.metricLabel}>Self-corrections:</Text>
              <Text style={styles.metricValue}>
                {feedback.fluencyAnalysis.selfCorrections}
              </Text>
            </View>
            {feedback.fluencyAnalysis.hesitationMarkers.length > 0 && (
              <View style={styles.analysisRow}>
                <Text style={styles.metricLabel}>Hesitations:</Text>
                <Text style={styles.metricValue}>
                  {feedback.fluencyAnalysis.hesitationMarkers.join(", ")}
                </Text>
              </View>
            )}
            {feedback.fluencyAnalysis.fillerWords.length > 0 && (
              <View style={styles.analysisRow}>
                <Text style={styles.metricLabel}>Filler Words:</Text>
                <Text style={styles.metricValue}>
                  {feedback.fluencyAnalysis.fillerWords.join(", ")}
                </Text>
              </View>
            )}
            <Text style={styles.assessmentText}>
              {feedback.fluencyAnalysis.assessment}
            </Text>
          </AccordionSection>
        </Card>
      )}

      {/* Extended Analysis - Pronunciation */}
      {feedback.pronunciationAnalysis && (
        <Card>
          <AccordionSection
            title="🎤 Pronunciation Analysis"
            defaultExpanded={false}
          >
            <View style={styles.analysisRow}>
              <Text style={styles.metricLabel}>Clarity:</Text>
              <Text style={styles.metricValue}>
                {feedback.pronunciationAnalysis.clarity}/10
              </Text>
            </View>
            {feedback.pronunciationAnalysis.problematicSounds.length > 0 && (
              <View style={styles.analysisRow}>
                <Text style={styles.metricLabel}>Problematic Sounds:</Text>
                <Text style={styles.metricValue}>
                  {feedback.pronunciationAnalysis.problematicSounds.join(", ")}
                </Text>
              </View>
            )}
            {feedback.pronunciationAnalysis.wordLevelErrors.length > 0 && (
              <View style={styles.wordErrorsContainer}>
                <Text style={styles.metricLabel}>Word-Level Errors:</Text>
                {feedback.pronunciationAnalysis.wordLevelErrors.map(
                  (error, index) => (
                    <View key={index} style={styles.errorCard}>
                      <Text style={styles.errorWord}>{error.word}</Text>
                      <Text style={styles.errorIssue}>{error.issue}</Text>
                      <Text style={styles.errorCorrection}>
                        ✓ {error.correction}
                      </Text>
                    </View>
                  )
                )}
              </View>
            )}
            <Text style={styles.analysisSubheading}>Stress Patterns:</Text>
            <Text style={styles.analysisDetail}>
              {feedback.pronunciationAnalysis.stressPatterns}
            </Text>
            <Text style={styles.analysisSubheading}>Intonation:</Text>
            <Text style={styles.analysisDetail}>
              {feedback.pronunciationAnalysis.intonation}
            </Text>
            <Text style={styles.assessmentText}>
              {feedback.pronunciationAnalysis.assessment}
            </Text>
          </AccordionSection>
        </Card>
      )}

      {/* Extended Analysis - Lexical */}
      {feedback.lexicalAnalysis && (
        <Card>
          <AccordionSection
            title="📚 Vocabulary Analysis"
            defaultExpanded={false}
          >
            <View style={styles.analysisRow}>
              <Text style={styles.metricLabel}>Range:</Text>
              <Text style={styles.metricValue}>
                {feedback.lexicalAnalysis.vocabularyRange}
              </Text>
            </View>
            {feedback.lexicalAnalysis.sophisticatedWords.length > 0 && (
              <View style={styles.chipContainer}>
                <Text style={styles.metricLabel}>Sophisticated Words:</Text>
                <View style={styles.chips}>
                  {feedback.lexicalAnalysis.sophisticatedWords.map(
                    (word, index) => (
                      <View key={index} style={styles.chip}>
                        <Text style={styles.chipText}>{word}</Text>
                      </View>
                    )
                  )}
                </View>
              </View>
            )}
            {feedback.lexicalAnalysis.collocations.length > 0 && (
              <View style={styles.chipContainer}>
                <Text style={styles.metricLabel}>Collocations:</Text>
                <View style={styles.chips}>
                  {feedback.lexicalAnalysis.collocations.map(
                    (phrase, index) => (
                      <View key={index} style={styles.chip}>
                        <Text style={styles.chipText}>{phrase}</Text>
                      </View>
                    )
                  )}
                </View>
              </View>
            )}
            {feedback.lexicalAnalysis.repetitions.length > 0 && (
              <View style={styles.wordErrorsContainer}>
                <Text style={styles.metricLabel}>Repeated Words:</Text>
                {feedback.lexicalAnalysis.repetitions.map((rep, index) => (
                  <Text key={index} style={styles.repetitionText}>
                    "{rep.word}" - used {rep.count} times
                  </Text>
                ))}
              </View>
            )}
            {feedback.lexicalAnalysis.inappropriateUsage.length > 0 && (
              <View style={styles.wordErrorsContainer}>
                <Text style={styles.metricLabel}>Inappropriate Usage:</Text>
                {feedback.lexicalAnalysis.inappropriateUsage.map(
                  (usage, index) => (
                    <View key={index} style={styles.errorCard}>
                      <Text style={styles.errorWord}>"{usage.word}"</Text>
                      <Text style={styles.errorIssue}>
                        Context: {usage.context}
                      </Text>
                      <Text style={styles.errorCorrection}>
                        ✓ {usage.suggestion}
                      </Text>
                    </View>
                  )
                )}
              </View>
            )}
            <Text style={styles.assessmentText}>
              {feedback.lexicalAnalysis.assessment}
            </Text>
          </AccordionSection>
        </Card>
      )}

      {/* Extended Analysis - Grammatical */}
      {feedback.grammaticalAnalysis && (
        <Card>
          <AccordionSection title="📝 Grammar Analysis" defaultExpanded={false}>
            <View style={styles.analysisRow}>
              <Text style={styles.metricLabel}>Sentence Complexity:</Text>
              <Text style={styles.metricValue}>
                {feedback.grammaticalAnalysis.sentenceComplexity}
              </Text>
            </View>
            {feedback.grammaticalAnalysis.structureVariety.length > 0 && (
              <View style={styles.chipContainer}>
                <Text style={styles.metricLabel}>Structures Used:</Text>
                <View style={styles.chips}>
                  {feedback.grammaticalAnalysis.structureVariety.map(
                    (structure, index) => (
                      <View key={index} style={styles.chip}>
                        <Text style={styles.chipText}>{structure}</Text>
                      </View>
                    )
                  )}
                </View>
              </View>
            )}
            <Text style={styles.analysisSubheading}>Tense Control:</Text>
            <Text style={styles.analysisDetail}>
              {feedback.grammaticalAnalysis.tenseControl}
            </Text>
            {feedback.grammaticalAnalysis.errors.length > 0 && (
              <View style={styles.wordErrorsContainer}>
                <Text style={styles.metricLabel}>Grammar Errors:</Text>
                {feedback.grammaticalAnalysis.errors.map((error, index) => (
                  <View key={index} style={styles.grammarErrorCard}>
                    <Text style={styles.errorType}>
                      {error.type.toUpperCase()}
                    </Text>
                    <Text style={styles.errorExample}>❌ {error.example}</Text>
                    <Text style={styles.errorCorrection}>
                      ✓ {error.correction}
                    </Text>
                    <Text style={styles.errorExplanation}>
                      {error.explanation}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.assessmentText}>
              {feedback.grammaticalAnalysis.assessment}
            </Text>
          </AccordionSection>
        </Card>
      )}

      {/* Extended Analysis - Coherence */}
      {feedback.coherenceCohesion && (
        <Card>
          <AccordionSection
            title="🔗 Coherence & Cohesion"
            defaultExpanded={false}
          >
            <View style={styles.analysisRow}>
              <Text style={styles.metricLabel}>Logical Flow:</Text>
              <Text style={styles.metricValue}>
                {feedback.coherenceCohesion.logicalFlow}/10
              </Text>
            </View>
            {feedback.coherenceCohesion.linkingWords.length > 0 && (
              <View style={styles.chipContainer}>
                <Text style={styles.metricLabel}>Linking Words:</Text>
                <View style={styles.chips}>
                  {feedback.coherenceCohesion.linkingWords.map(
                    (word, index) => (
                      <View key={index} style={styles.chip}>
                        <Text style={styles.chipText}>{word}</Text>
                      </View>
                    )
                  )}
                </View>
              </View>
            )}
            <Text style={styles.analysisSubheading}>Topic Development:</Text>
            <Text style={styles.analysisDetail}>
              {feedback.coherenceCohesion.topicDevelopment}
            </Text>
            <Text style={styles.analysisSubheading}>Organization:</Text>
            <Text style={styles.analysisDetail}>
              {feedback.coherenceCohesion.organization}
            </Text>
            <Text style={styles.assessmentText}>
              {feedback.coherenceCohesion.assessment}
            </Text>
          </AccordionSection>
        </Card>
      )}
    </ScrollView>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  container: {
    flex: 1,
  },
  scoreCard: {
    alignItems: "center",
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  overallScoreContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: spacing.lg,
  },
  overallScore: {
    fontSize: 56,
    fontWeight: "700",
  },
  outOf: {
    fontSize: 24,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
  bandBreakdownContainer: {
    width: "100%",
    gap: spacing.sm,
  },
  bandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  bandLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  listItem: {
    flexDirection: "row",
    marginBottom: spacing.sm,
  },
  bullet: {
    fontSize: 18,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  listText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  accordionContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  accordionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  accordionContent: {
    paddingBottom: spacing.md,
  },
  analysisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    flex: 1,
  },
  metricValue: {
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
    textAlign: "right",
  },
  analysisSubheading: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  analysisDetail: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  assessmentText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
    fontStyle: "italic",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  wordErrorsContainer: {
    marginTop: spacing.md,
  },
  errorCard: {
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.sm,
    borderRadius: 8,
    marginTop: spacing.sm,
  },
  errorWord: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  errorIssue: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  errorCorrection: {
    fontSize: 13,
    color: colors.success,
    fontWeight: "600",
  },
  grammarErrorCard: {
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.sm,
    borderRadius: 8,
    marginTop: spacing.sm,
  },
  errorType: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  errorExample: {
    fontSize: 14,
    color: colors.danger,
    marginBottom: spacing.xs,
  },
  errorExplanation: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontStyle: "italic",
  },
  chipContainer: {
    marginBottom: spacing.md,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 16,
  },
  chipText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "600",
  },
  repetitionText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  });
