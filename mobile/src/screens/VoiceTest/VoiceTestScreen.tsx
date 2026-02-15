import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { GeneratedTopic, getCachedRandomTopic } from "../../api/topicApi";
import { favoritesApi, practiceApi } from "../../api/services";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { PartSelectionModal } from "../../components/PartSelectionModal";
import { ScreenContainer } from "../../components/ScreenContainer";
import { UsageLimitModal } from "../../components/UsageLimitModal";
import { VoiceConversation } from "../../components/VoiceConversationV2";
import { useTheme } from "../../context";
import { useThemedStyles, useUsageGuard } from "../../hooks";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import type { MainTabParamList } from "../../navigation/AppNavigator";
import { resultsStorage } from "../../services/resultsStorage";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { extractErrorMessage } from "../../utils/errors";
import { uuidv4 } from "../../utils/uuid";
import { EvaluationResultsScreen } from "../EvaluationResults/EvaluationResultsScreen";

type VoiceTestScreenRouteProp = RouteProp<MainTabParamList, "VoiceTest">;

export const VoiceTestScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<VoiceTestScreenRouteProp>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { isOffline } = useNetworkStatus();

  const favoriteQuestionsQuery = useQuery({
    queryKey: ["favorites", "ielts_question"],
    queryFn: () => favoritesApi.list("ielts_question"),
    enabled: !isOffline,
  });

  const favoriteQuestionIds = useMemo(
    () => new Set<string>(favoriteQuestionsQuery.data ?? []),
    [favoriteQuestionsQuery.data]
  );

  const toggleQuestionFavorite = useMutation({
    mutationFn: async (payload: { questionId: string; isFavorite: boolean }) => {
      if (payload.isFavorite) {
        await favoritesApi.remove("ielts_question", payload.questionId);
        return;
      }
      await favoritesApi.add({ entityType: "ielts_question", entityId: payload.questionId });
    },
    onSuccess: () => {
      queryClient
        .invalidateQueries({ queryKey: ["favorites", "ielts_question"] })
        .catch(() => undefined);
    },
    onError: (error) => {
      Alert.alert("Unable to update favorite", extractErrorMessage(error));
    },
  });

  const [showVoiceUI, setShowVoiceUI] = useState(false);
  const [showPartSelection, setShowPartSelection] = useState(false);
  const [selectedPart, setSelectedPart] = useState<1 | 2 | 3>(1);
  const [currentTopic, setCurrentTopic] = useState<GeneratedTopic | null>(null);
  const [isLoadingTopic, setIsLoadingTopic] = useState(false);

  const [showEvaluation, setShowEvaluation] = useState(false);
  const [evaluationData, setEvaluationData] = useState<any>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);

  const { ensureCanStart, limitState, dismissLimit, refreshUsage, subscriptionInfo } =
    useUsageGuard();

  // Handle retry from results screen
  useEffect(() => {
    const retry = (route.params as any)?.retryData as
      | { part: 1 | 2 | 3; topic: string; question: string }
      | undefined;
    if (!retry) {
      return;
    }

    const retryTopic: GeneratedTopic = {
      question: retry.question,
      category: `part${retry.part}` as "part1" | "part2" | "part3",
      difficulty: "medium",
      keywords: [retry.topic],
      cueCard:
        retry.part === 2
          ? {
              mainTopic: retry.topic,
              bulletPoints: [],
              timeToSpeak: 120,
              preparationTime: 60,
            }
          : undefined,
    };

    setCurrentTopic(retryTopic);
    setSelectedPart(retry.part);
    setSessionId(uuidv4());
    setSessionStartTime(Date.now());
    setShowVoiceUI(true);

    navigation.setParams({ retryData: undefined } as any);
  }, [navigation, route.params]);

  const startPractice = useCallback(() => {
    if (!ensureCanStart("practice")) {
      return;
    }
    setShowPartSelection(true);
  }, [ensureCanStart]);

  const handlePartSelected = useCallback(
    async (part: 1 | 2 | 3) => {
      try {
        setSelectedPart(part);
        setIsLoadingTopic(true);

        const partName = `part${part}` as "part1" | "part2" | "part3";
        const usedQuestions = await resultsStorage.getUsedQuestions();

        const topic = await getCachedRandomTopic(partName, "medium", usedQuestions);
        await resultsStorage.markQuestionAsUsed(topic.question, part);

        setCurrentTopic(topic);
        setSessionId(uuidv4());
        setSessionStartTime(Date.now());
        setShowVoiceUI(true);
      } catch (error) {
        Alert.alert(
          "Unable to start",
          extractErrorMessage(
            error,
            "Failed to load a practice question. Please check your connection and try again."
          )
        );
      } finally {
        setIsLoadingTopic(false);
      }
    },
    []
  );

  const handleSessionEnd = useCallback(async () => {
    setShowVoiceUI(false);
    await refreshUsage();
  }, [refreshUsage]);

  const handleEvaluationComplete = useCallback(
    async (data: {
      overallBand: number;
      spokenSummary?: string;
      criteria: any;
      corrections: any[];
      suggestions: any[];
      transcript: string;
      audioUri: string;
      audioRecordingId?: string;
      sessionId?: string;
      duration: number;
      bandComparison?: any;
    }) => {
      let normalizedData: any = null;
      try {
        const normalizeArray = <T,>(value: T[] | undefined | null): T[] =>
          Array.isArray(value) ? value : [];

        const sanitizeLinkingGroups = (value: any) =>
          normalizeArray(value)
            .map((group: any) => ({
              context:
                typeof group?.context === "string" ? group.context.trim() : "",
              phrases: normalizeArray(group?.phrases).filter(
                (phrase): phrase is string =>
                  typeof phrase === "string" && phrase.trim().length > 0
              ),
            }))
            .filter(
              (group) => group.context.length > 0 || group.phrases.length > 0
            );

        const sanitizeVocabularyAlternatives = (value: any) =>
          normalizeArray(value)
            .map((entry: any) => ({
              original:
                typeof entry?.original === "string" ? entry.original.trim() : "",
              alternatives: normalizeArray(entry?.alternatives).filter(
                (alt): alt is string =>
                  typeof alt === "string" && alt.trim().length > 0
              ),
              exampleSentence:
                typeof entry?.exampleSentence === "string"
                  ? entry.exampleSentence.trim()
                  : "",
            }))
            .filter(
              (entry) =>
                entry.original.length > 0 || entry.alternatives.length > 0
            );

        const sanitizeDetailedExamples = (value: any) =>
          normalizeArray(value)
            .map((entry: any) => ({
              issue: typeof entry?.issue === "string" ? entry.issue.trim() : "",
              yourResponse:
                typeof entry?.yourResponse === "string"
                  ? entry.yourResponse.trim()
                  : "",
              betterAlternative:
                typeof entry?.betterAlternative === "string"
                  ? entry.betterAlternative.trim()
                  : "",
              explanation:
                typeof entry?.explanation === "string"
                  ? entry.explanation.trim()
                  : "",
              suggestion:
                typeof entry?.suggestion === "string"
                  ? entry.suggestion.trim()
                  : undefined,
            }))
            .filter(
              (entry) =>
                entry.issue.length > 0 ||
                entry.yourResponse.length > 0 ||
                entry.betterAlternative.length > 0 ||
                entry.explanation.length > 0
            );

        const sanitizeCollocations = (value: any) =>
          normalizeArray(value)
            .map((entry: any) => ({
              phrase: typeof entry?.phrase === "string" ? entry.phrase.trim() : "",
              example: typeof entry?.example === "string" ? entry.example.trim() : "",
            }))
            .filter(
              (entry) => entry.phrase.length > 0 || entry.example.length > 0
            );

        const sanitizeCorrections = (value: any) =>
          normalizeArray(value)
            .map((entry: any) => ({
              original:
                typeof entry?.original === "string" ? entry.original.trim() : "",
              corrected:
                typeof entry?.corrected === "string"
                  ? entry.corrected.trim()
                  : "",
              explanation:
                typeof entry?.explanation === "string"
                  ? entry.explanation.trim()
                  : "",
            }))
            .filter(
              (entry) => entry.original.length > 0 || entry.corrected.length > 0
            );

        const sanitizeSuggestions = (value: any) =>
          normalizeArray(value)
            .map((entry: any) =>
              typeof entry === "string"
                ? entry.trim()
                : typeof entry?.suggestion === "string"
                ? entry.suggestion.trim()
                : ""
            )
            .filter((entry) => entry.length > 0);

        const ensureCriteriaSection = (
          section: any,
          options?: { includeLexicalExtras?: boolean; includeLinking?: boolean }
        ) => {
          const strengths = normalizeArray(section?.strengths).filter(
            (item): item is string =>
              typeof item === "string" && item.trim().length > 0
          );
          const improvements = normalizeArray(section?.improvements).filter(
            (item): item is string =>
              typeof item === "string" && item.trim().length > 0
          );
          const detailedExamples = sanitizeDetailedExamples(section?.detailedExamples);

          return {
            band: typeof section?.band === "number" ? section.band : 0,
            feedback: typeof section?.feedback === "string" ? section.feedback : "",
            strengths,
            improvements,
            detailedExamples,
            linkingPhrases: options?.includeLinking
              ? sanitizeLinkingGroups(section?.linkingPhrases)
              : undefined,
            vocabularyAlternatives: options?.includeLexicalExtras
              ? sanitizeVocabularyAlternatives(section?.vocabularyAlternatives)
              : undefined,
            collocations: options?.includeLexicalExtras
              ? sanitizeCollocations(section?.collocations)
              : undefined,
          };
        };

        const overallBand =
          typeof data.overallBand === "number" ? data.overallBand : 0;

        const ensureBandComparison = (comparison: any) => {
          if (!comparison) {
            return undefined;
          }

          const fallbackNextBand = Math.min(overallBand + 0.5, 9);
          const currentBandLabel =
            typeof comparison.currentBandLabel === "string" &&
            comparison.currentBandLabel.trim().length > 0
              ? comparison.currentBandLabel.trim()
              : `Band ${overallBand.toFixed(1)} Overview`;

          const nextBandLabel =
            typeof comparison.nextBandLabel === "string" &&
            comparison.nextBandLabel.trim().length > 0
              ? comparison.nextBandLabel.trim()
              : "Next Band Target";

          const nextBandExample = comparison.nextBandExample || {};

          const sanitizedResponse =
            typeof nextBandExample.response === "string" &&
            nextBandExample.response.trim().length > 0
              ? nextBandExample.response.trim()
              : "";

          return {
            currentBandLabel,
            currentBandCharacteristics: normalizeArray(
              comparison.currentBandCharacteristics
            ).filter(
              (item): item is string =>
                typeof item === "string" && item.trim().length > 0
            ),
            nextBandLabel,
            nextBandCharacteristics: normalizeArray(
              comparison.nextBandCharacteristics
            ).filter(
              (item): item is string =>
                typeof item === "string" && item.trim().length > 0
            ),
            nextBandExample: sanitizedResponse
              ? {
                  band:
                    typeof nextBandExample.band === "number"
                      ? nextBandExample.band
                      : fallbackNextBand,
                  title:
                    typeof nextBandExample.title === "string"
                      ? nextBandExample.title.trim()
                      : undefined,
                  response: sanitizedResponse,
                  highlights: normalizeArray(nextBandExample.highlights).filter(
                    (item): item is string =>
                      typeof item === "string" && item.trim().length > 0
                  ),
                }
              : undefined,
            band9Example:
              typeof comparison.band9Example === "string"
                ? comparison.band9Example.trim()
                : "",
          };
        };

        const criteria = {
          fluencyCoherence: ensureCriteriaSection(data.criteria?.fluencyCoherence),
          lexicalResource: ensureCriteriaSection(data.criteria?.lexicalResource, {
            includeLexicalExtras: true,
          }),
          grammaticalRange: ensureCriteriaSection(data.criteria?.grammaticalRange),
          pronunciation: ensureCriteriaSection(data.criteria?.pronunciation, {
            includeLinking: true,
          }),
        };

        normalizedData = {
          overallBand,
          spokenSummary: data.spokenSummary,
          criteria,
          corrections: sanitizeCorrections(data.corrections),
          suggestions: sanitizeSuggestions(data.suggestions),
          transcript: data.transcript || "",
          audioUri: data.audioUri,
          duration: data.duration,
          bandComparison: ensureBandComparison(data.bandComparison),
          testPart: `Part ${selectedPart}`,
          sessionId: data.sessionId || sessionId || undefined,
          audioRecordingId: data.audioRecordingId,
        };

        // Persist to backend practice history (canonical) so Results is fully server-backed.
        const voiceSessionId = String(normalizedData.sessionId || "").trim();
        const audioRecordingId = String(normalizedData.audioRecordingId || "").trim();
        if (!voiceSessionId) {
          throw new Error("Missing session id for voice session");
        }
        if (!audioRecordingId) {
          throw new Error("Missing audio recording id from transcription");
        }

        const topicTitle =
          currentTopic?.cueCard?.mainTopic ||
          currentTopic?.keywords?.[0] ||
          currentTopic?.category ||
          "Voice practice";

        await practiceApi.voiceComplete({
          sessionId: voiceSessionId,
          questionId: currentTopic?.questionId,
          topicTitle,
          question: currentTopic?.question || "",
          part: selectedPart,
          difficulty: currentTopic?.difficulty,
          durationSeconds: Number(normalizedData.duration || 0),
          transcript: normalizedData.transcript,
          evaluation: {
            overallBand: normalizedData.overallBand,
            spokenSummary: normalizedData.spokenSummary,
            criteria: normalizedData.criteria,
            corrections: normalizedData.corrections,
            suggestions: normalizedData.suggestions,
            bandComparison: normalizedData.bandComparison,
          },
          audioRecordingId,
        });

        queryClient.invalidateQueries({ queryKey: ["practice-results"] }).catch(() => undefined);
        queryClient.invalidateQueries({ queryKey: ["practice-sessions"] }).catch(() => undefined);
        queryClient.invalidateQueries({ queryKey: ["recordings"] }).catch(() => undefined);

        setEvaluationData(normalizedData);
        setShowVoiceUI(false);
        setShowEvaluation(true);
        await refreshUsage();
      } catch (error) {
        setEvaluationData(normalizedData || { ...data, testPart: `Part ${selectedPart}` });
        setShowVoiceUI(false);
        setShowEvaluation(true);
      }
    },
    [currentTopic?.category, currentTopic?.question, queryClient, refreshUsage, selectedPart, sessionId]
  );

  const canUpgrade = !!subscriptionInfo?.stripe?.enabled;
  const currentQuestionId = currentTopic?.questionId;
  const isCurrentQuestionFavorited = currentQuestionId
    ? favoriteQuestionIds.has(currentQuestionId)
    : false;

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <Text style={styles.title}>Speak practice</Text>
        <Text style={styles.subtitle}>
          Answer a real IELTS prompt out loud and get AI feedback with band
          scores and actionable improvements.
        </Text>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Start a voice session</Text>
          <Text style={styles.cardDescription}>
            Choose Part 1, 2, or 3. Record your answer and receive a full
            breakdown.
          </Text>

          {isLoadingTopic ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>Loading question…</Text>
            </View>
          ) : (
            <Button
              title="Choose a part"
              onPress={startPractice}
              disabled={showVoiceUI || isLoadingTopic}
            />
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Take a mock test</Text>
          <Text style={styles.cardDescription}>
            Run a full simulation across Parts 1–3 and get overall feedback.
          </Text>
          <Button
            title="Start mock test"
            variant="secondary"
            onPress={() => navigation.navigate("Simulations")}
          />
        </Card>
      </View>

      <PartSelectionModal
        visible={showPartSelection}
        onClose={() => setShowPartSelection(false)}
        onSelectPart={handlePartSelected}
      />

      <Modal
        visible={showVoiceUI}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleSessionEnd}
      >
        <VoiceConversation
          mode="practice"
          sessionId={sessionId || undefined}
          question={currentTopic ? currentTopic.question : undefined}
          topic={
            currentTopic?.cueCard?.mainTopic ||
            currentTopic?.keywords?.[0] ||
            undefined
          }
          part={selectedPart}
          isFavorited={isCurrentQuestionFavorited}
          onToggleFavorite={
            currentQuestionId
              ? () =>
                  toggleQuestionFavorite.mutate({
                    questionId: currentQuestionId,
                    isFavorite: isCurrentQuestionFavorited,
                  })
              : undefined
          }
          favoriteDisabled={isOffline || toggleQuestionFavorite.isPending}
          onEnd={handleSessionEnd}
          onEvaluationComplete={handleEvaluationComplete}
        />
      </Modal>

      <Modal
        visible={showEvaluation}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowEvaluation(false)}
      >
        {evaluationData ? (
          <EvaluationResultsScreen
            overallBand={evaluationData.overallBand}
            criteria={evaluationData.criteria}
            corrections={evaluationData.corrections || []}
            suggestions={evaluationData.suggestions || []}
            bandComparison={evaluationData.bandComparison}
            onClose={() => setShowEvaluation(false)}
            onTryAgain={async () => {
              if (currentTopic && selectedPart) {
                await resultsStorage.unmarkQuestion(currentTopic.question, selectedPart);
              }
              setShowEvaluation(false);
              setShowVoiceUI(true);
            }}
            userId={user?._id}
            sessionId={evaluationData.sessionId || sessionId || undefined}
            testType="practice"
            topic={evaluationData.topic || currentTopic?.question || undefined}
            testPart={evaluationData.testPart}
            audioRecordingId={evaluationData.audioRecordingId}
            durationSeconds={
              evaluationData.durationSeconds !== undefined
                ? evaluationData.durationSeconds
                : sessionStartTime
                ? Math.floor((Date.now() - sessionStartTime) / 1000)
                : undefined
            }
          />
        ) : null}
      </Modal>

      {limitState ? (
        <UsageLimitModal
          visible
          sessionType={limitState.sessionType}
          currentTier={limitState.currentTier}
          used={limitState.used}
          limit={limitState.limit}
          resetDate={limitState.resetDate}
          onClose={dismissLimit}
          upgradeEnabled={canUpgrade}
          onUpgrade={() => {
            dismissLimit();
            if (!canUpgrade) {
              Alert.alert(
                "Unavailable",
                "Billing is disabled in this build. Please try again after your usage resets."
              );
              return;
            }
            navigation.getParent?.()?.navigate?.("Profile") ?? navigation.navigate("Profile");
          }}
        />
      ) : null}
    </ScreenContainer>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: spacing.lg,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    subtitle: {
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    card: {
      marginBottom: spacing.md,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    cardDescription: {
      color: colors.textSecondary,
      marginBottom: spacing.sm,
      lineHeight: 20,
    },
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    loadingText: {
      color: colors.textSecondary,
      fontWeight: "600",
    },
  });
