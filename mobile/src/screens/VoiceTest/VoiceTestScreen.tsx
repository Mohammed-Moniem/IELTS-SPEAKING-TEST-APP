import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { subscriptionApi } from "../../api/services";
import { useAuth } from "../../auth/AuthContext";
import { GeneratedTopic, getCachedRandomTopic } from "../../api/topicApi";
import { AuthenticFullTest } from "../../components/AuthenticFullTest";
import { AuthenticFullTestV2 } from "../../components/AuthenticFullTestV2";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { PartSelectionModal } from "../../components/PartSelectionModal";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SimulationMode } from "../../components/SimulationMode";
import {
  SubscriptionPlanOption,
  SubscriptionPlansModal,
} from "../../components/SubscriptionPlansModal";
import { UsageLimitModal } from "../../components/UsageLimitModal";
import { VoiceConversation } from "../../components/VoiceConversationV2";
import { useTheme } from "../../context";
import { useThemedStyles, useUsageGuard } from "../../hooks";
import { DEFAULT_SUBSCRIPTION_PLANS } from "../../constants/subscriptionPlans";
import { AppTabParamList } from "../../navigation/AppNavigator";
import { resultsStorage } from "../../services/resultsStorage";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { EvaluationResultsScreen } from "../EvaluationResults/EvaluationResultsScreen";

type VoiceTestScreenRouteProp = RouteProp<AppTabParamList, "VoiceTest">;
type VoiceTestNavigationProp = BottomTabNavigationProp<
  AppTabParamList,
  "VoiceTest"
>;

export const VoiceTestScreen: React.FC = () => {
  const navigation = useNavigation<VoiceTestNavigationProp>();
  const route = useRoute<VoiceTestScreenRouteProp>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [showVoiceUI, setShowVoiceUI] = useState(false);
  const [showPartSelection, setShowPartSelection] = useState(false);
  const [selectedPart, setSelectedPart] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<
    "practice" | "simulation" | "fulltest" | "fulltest-v2"
  >("practice");
  const [currentTopic, setCurrentTopic] = useState<GeneratedTopic | null>(null);
  const [isLoadingTopic, setIsLoadingTopic] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [evaluationData, setEvaluationData] = useState<any>(null);

  // Session tracking for analytics
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);

  const [showPlansModal, setShowPlansModal] = useState(false);
  const autoStartHandled = useRef(false);

  const {
    ensureCanStart,
    limitState,
    dismissLimit,
    refreshUsage,
    subscriptionInfo,
  } = useUsageGuard();

  const subscriptionConfigQuery = useQuery({
    queryKey: ["subscription-config"],
    queryFn: subscriptionApi.config,
  });

  const planOptions = useMemo<SubscriptionPlanOption[]>(() => {
    const configPlans = subscriptionConfigQuery.data?.plans;
    if (configPlans?.length) {
      return configPlans.map((plan) => ({
        tier: plan.tier,
        name: plan.name,
        price: plan.price,
        currency: plan.currency,
        description: plan.description,
        features: plan.features,
        limits: plan.limits,
      }));
    }
    return DEFAULT_SUBSCRIPTION_PLANS;
  }, [subscriptionConfigQuery.data]);

  const currentPlanTier = subscriptionInfo?.planType ?? "free";

  // Handle retry from results screen
  useEffect(() => {
    const params = route.params as any;
    if (params?.retryData) {
      const { part, topic, question } = params.retryData;

      // Create a topic object for retry
      const retryTopic: GeneratedTopic = {
        question: question,
        category: `part${part}` as "part1" | "part2" | "part3",
        difficulty: "medium",
        keywords: [topic],
        cueCard:
          part === 2
            ? {
                mainTopic: topic,
                bulletPoints: [],
                timeToSpeak: 120,
                preparationTime: 60,
              }
            : undefined,
      };

      setCurrentTopic(retryTopic);
      setSelectedPart(part);
      setMode("practice");
      setShowVoiceUI(true);

      // Clear the params after handling
      // Note: In a real app, you might want to use navigation.setParams({})
    }
  }, [route.params]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const modeParam = route.params?.autoStartMode;
    if (!modeParam || autoStartHandled.current) {
      return;
    }
    autoStartHandled.current = true;
    navigation.setParams({ autoStartMode: undefined } as any);

    if (modeParam === "fulltest") {
      void startFullTest();
    } else if (modeParam === "fulltest-v2") {
      setMode("fulltest-v2");
      setShowVoiceUI(true);
    } else if (modeParam === "practice") {
      void startPractice();
    } else if (modeParam === "simulation") {
      void startSimulation();
    }
  }, [navigation, route.params?.autoStartMode]);

  const requireAuthenticatedUser = () => {
    if (!user?._id) {
      Alert.alert("Please sign in", "You need an account to start a session.");
      return false;
    }
    return true;
  };

  const startPractice = () => {
    if (!requireAuthenticatedUser() || !ensureCanStart("practice")) {
      return;
    }
    setShowPartSelection(true);
  };

  const handlePartSelected = async (part: 1 | 2 | 3) => {
    try {
      setSelectedPart(part);
      setIsLoadingTopic(true);

      // Map part to topic part name
      const partName = `part${part}` as "part1" | "part2" | "part3";

      // Get list of used questions to avoid duplicates
      const usedQuestions = await resultsStorage.getUsedQuestions();
      console.log(`📋 Used questions count: ${usedQuestions.length}`);

      // Get a random question for the selected part (excluding used ones)
      const topic = await getCachedRandomTopic(
        partName,
        "medium",
        usedQuestions
      );

      console.log(`📝 Got Part ${part} topic:`, topic);

      // Mark this question as used
      await resultsStorage.markQuestionAsUsed(topic.question, part);

      setCurrentTopic(topic);
      setMode("practice");
      setShowVoiceUI(true);
    } catch (error: any) {
      console.error("Failed to get topic:", error);
      const errorMessage = error.message?.includes("timeout")
        ? "Request took too long. The AI is generating your topic. Please try again."
        : "Failed to load practice question. Please check your connection and try again.";

      Alert.alert("Connection Error", errorMessage, [{ text: "OK" }]);
    } finally {
      setIsLoadingTopic(false);
    }
  };

  const startSimulation = () => {
    if (!requireAuthenticatedUser() || !ensureCanStart("simulation")) {
      return;
    }
    setMode("simulation");
    const newSessionId = `session_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    setSessionId(newSessionId);
    setSessionStartTime(Date.now());
    setShowVoiceUI(true);
  };

  const startFullTest = () => {
    if (!requireAuthenticatedUser() || !ensureCanStart("simulation")) {
      return;
    }
    setMode("fulltest");
    const newSessionId = `fulltest_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    setSessionId(newSessionId);
    setSessionStartTime(Date.now());
    setShowVoiceUI(true);
  };

  const handleSessionEnd = async () => {
    setShowVoiceUI(false);
    await refreshUsage();
  };

  const handleEvaluationComplete = async (data: {
    overallBand: number;
    criteria: any;
    corrections: any[];
    suggestions: any[];
    transcript: string;
    audioUri: string;
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
            phrase:
              typeof entry?.phrase === "string" ? entry.phrase.trim() : "",
            example:
              typeof entry?.example === "string" ? entry.example.trim() : "",
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
        const detailedExamples = sanitizeDetailedExamples(
          section?.detailedExamples
        );

        return {
          band: typeof section?.band === "number" ? section.band : 0,
          feedback:
            typeof section?.feedback === "string" ? section.feedback : "",
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
            : "A higher-band speaker would extend ideas with precise vocabulary, cohesive linking devices, and clearer examples related to the question.";

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
          nextBandExample: {
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
          },
          band9Example:
            typeof comparison.band9Example === "string" &&
            comparison.band9Example.trim().length > 0
              ? comparison.band9Example.trim()
              : "A Band 9 response delivers a fully developed, coherent answer with sophisticated, precise vocabulary, effortless control of complex grammar, and native-like pronunciation throughout.",
        };
      };

      normalizedData = {
        ...data,
        overallBand,
        criteria: {
          fluencyCoherence: ensureCriteriaSection(
            data.criteria?.fluencyCoherence,
            { includeLinking: true }
          ),
          lexicalResource: ensureCriteriaSection(
            data.criteria?.lexicalResource,
            {
              includeLexicalExtras: true,
            }
          ),
          grammaticalRange: ensureCriteriaSection(
            data.criteria?.grammaticalRange
          ),
          pronunciation: ensureCriteriaSection(data.criteria?.pronunciation),
        },
        corrections: sanitizeCorrections(data.corrections),
        suggestions: sanitizeSuggestions(data.suggestions),
        bandComparison: ensureBandComparison(data.bandComparison),
        testPart: `Part ${selectedPart}`,
      };

      const criteriaSummary = {
        fluency: {
          score: normalizedData.criteria.fluencyCoherence.band || 0,
          feedback: normalizedData.criteria.fluencyCoherence.feedback || "",
        },
        lexicalResource: {
          score: normalizedData.criteria.lexicalResource.band || 0,
          feedback: normalizedData.criteria.lexicalResource.feedback || "",
        },
        grammaticalRange: {
          score: normalizedData.criteria.grammaticalRange.band || 0,
          feedback: normalizedData.criteria.grammaticalRange.feedback || "",
        },
        pronunciation: {
          score: normalizedData.criteria.pronunciation.band || 0,
          feedback: normalizedData.criteria.pronunciation.feedback || "",
        },
      };

      // Save result to AsyncStorage
      const result = {
        id: `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        part: selectedPart,
        topic: currentTopic?.category || "General",
        question: currentTopic?.question || "",
        transcript: normalizedData.transcript,
        audioUri: normalizedData.audioUri,
        evaluation: {
          overallBand: normalizedData.overallBand,
          criteria: criteriaSummary,
          detailed: normalizedData.criteria,
          corrections: normalizedData.corrections,
          suggestions: normalizedData.suggestions,
          bandComparison: normalizedData.bandComparison,
        },
        duration: normalizedData.duration,
      };

      await resultsStorage.savePracticeResult(result);
      queryClient
        .invalidateQueries({ queryKey: ["local-results"] })
        .catch(() => undefined);
      console.log("✅ Result saved to storage:", result.id);

      // Store evaluation data for immediate display
      setEvaluationData(normalizedData);

      // Close voice UI modal
      setShowVoiceUI(false);

      // Show evaluation results modal
      setShowEvaluation(true);
    } catch (error) {
      console.error("❌ Failed to save result:", error);

      // Still show evaluation even if save failed
      setEvaluationData(
        normalizedData || {
          ...data,
          testPart: `Part ${selectedPart}`,
        }
      );
      setShowVoiceUI(false);
      setShowEvaluation(true);
    }
  };

  const handleSelectPlan = async (
    plan: SubscriptionPlanOption,
    options?: { couponCode?: string }
  ) => {
    if (!requireAuthenticatedUser()) {
      return;
    }

    if (plan.tier === "free") {
      Alert.alert(
        "Plan already active",
        "You are already on the Free plan. Manage downgrades from Settings."
      );
      return;
    }

    try {
      const response = await subscriptionApi.checkout({
        planType: plan.tier,
        couponCode: options?.couponCode,
      });
      setShowPlansModal(false);

      if (response.checkoutUrl) {
        await WebBrowser.openBrowserAsync(response.checkoutUrl);
      } else {
        Alert.alert(
          "Checkout created",
          "Complete your upgrade from the web dashboard."
        );
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to start checkout.";
      Alert.alert("Unable to start checkout", message);
    }
  };

  return (
    <ScreenContainer scrollable>
      <View style={styles.container}>
        <Text style={styles.title}>🎤 Voice Interface Demo</Text>
        <Text style={styles.subtitle}>
          Test the new ChatGPT-style voice conversation interface
        </Text>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Practice Mode</Text>
          <Text style={styles.cardDescription}>
            Record your answer to a single question. Get detailed AI feedback
            with band scores.
          </Text>
          {isLoadingTopic ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading question...</Text>
            </View>
          ) : (
            <Button
              title="Start Practice Session"
              onPress={startPractice}
              style={styles.button}
              disabled={showVoiceUI || isLoadingTopic}
            />
          )}
          {showVoiceUI && (
            <Text style={styles.disabledText}>
              Complete your current session first
            </Text>
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>🎤 Simple Mic Test (V2)</Text>
          <Text style={styles.cardDescription}>
            NEW APPROACH: Simple mic button control. Press mic → Speak → Press
            again to stop. Full IELTS test with 11-14 minute duration. Parts 1,
            2, 3 with proper timing.
          </Text>
          <Button
            title="Try Simple Mic Test"
            onPress={() => {
              setMode("fulltest-v2");
              setShowVoiceUI(true);
            }}
            variant="primary"
            style={styles.button}
            disabled={showVoiceUI || isLoadingTopic}
          />
          {(showVoiceUI || isLoadingTopic) && (
            <Text style={styles.disabledText}>
              Complete your current session first
            </Text>
          )}
        </Card>
      </View>

      <Modal
        visible={showVoiceUI && mode === "practice"}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleSessionEnd}
      >
        <VoiceConversation
          mode="practice"
          question={currentTopic ? currentTopic.question : undefined}
          topic={undefined}
          part={selectedPart}
          onEnd={handleSessionEnd}
          onEvaluationComplete={handleEvaluationComplete}
        />
      </Modal>

      {/* Authentic Full Test Modal */}
      <Modal
        visible={showVoiceUI && mode === "fulltest"}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleSessionEnd}
      >
        <AuthenticFullTest
          onComplete={async (results) => {
            console.log("Full test complete:", results);
            try {
              const legacyQuestions: Array<{
                questionId?: string;
                question: string;
                category: string;
                difficulty?: string;
                topic?: string;
              }> = [];

              if (Array.isArray(results?.part1?.questions)) {
                legacyQuestions.push(
                  ...results.part1.questions.map((q: any) => ({
                    questionId: q?.questionId,
                    question: typeof q?.question === "string" ? q.question : "",
                    category: q?.category || "part1",
                    difficulty: q?.difficulty,
                    topic: Array.isArray(q?.keywords)
                      ? q.keywords[0]
                      : undefined,
                  }))
                );
              }

              if (results?.part2?.topic) {
                const topic = results.part2.topic;
                legacyQuestions.push({
                  questionId: topic.questionId,
                  question:
                    typeof topic.question === "string" ? topic.question : "",
                  category: "part2",
                  difficulty: topic.difficulty,
                  topic:
                    topic.cueCard?.mainTopic ||
                    (typeof topic.question === "string"
                      ? topic.question
                      : undefined),
                });
              }

              if (Array.isArray(results?.part3?.questions)) {
                legacyQuestions.push(
                  ...results.part3.questions.map((q: any) => ({
                    questionId: q?.questionId,
                    question: typeof q?.question === "string" ? q.question : "",
                    category: q?.category || "part3",
                    difficulty: q?.difficulty,
                    topic: Array.isArray(q?.keywords)
                      ? q.keywords[0]
                      : undefined,
                  }))
                );
              }

              await resultsStorage.saveFullTestResult({
                timestamp: Date.now(),
                durationSeconds: Number(results?.totalDuration) || 0,
                questions: legacyQuestions,
                source: "fulltest-legacy",
              });
              queryClient
                .invalidateQueries({ queryKey: ["full-test-results"] })
                .catch(() => undefined);
            } catch (error) {
              console.error("Failed to store legacy full test result", error);
            }
            handleSessionEnd();
            // TODO: Show results screen
            Alert.alert(
              "Test Complete!",
              "Your authentic IELTS test has been completed. Results will be evaluated soon.",
              [{ text: "OK" }]
            );
          }}
          onExit={handleSessionEnd}
        />
      </Modal>

      {/* Authentic Full Test V2 - Simple Mic Control */}
      <Modal
        visible={showVoiceUI && mode === "fulltest-v2"}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleSessionEnd}
      >
        <AuthenticFullTestV2
          onComplete={async (results) => {
            console.log("Full test V2 complete:", results);
            const evaluation = results?.evaluation;

            if (evaluation) {
              const suggestionStrings = Array.isArray(evaluation.suggestions)
                ? evaluation.suggestions
                    .map((item: any) => {
                      if (!item) {
                        return null;
                      }
                      if (typeof item === "string") {
                        return item;
                      }
                      if (typeof item.suggestion === "string") {
                        const base = item.suggestion.trim();
                        if (!base) {
                          return null;
                        }
                        return item.category
                          ? `${item.category}: ${base}`
                          : base;
                      }
                      return null;
                    })
                    .filter(
                      (value: unknown): value is string =>
                        typeof value === "string" && value.trim().length > 0
                    )
                : [];

              try {
                await resultsStorage.saveFullTestResult({
                  id: results?.testSessionId,
                  timestamp: Date.parse(results?.timestamp || "") || Date.now(),
                  durationSeconds: Number(results?.duration) || 0,
                  overallBand:
                    Number(results?.overallBand) ||
                    Number(evaluation.overallBand) ||
                    undefined,
                  partScores: results?.partScores || evaluation.partScores,
                  spokenSummary:
                    results?.spokenSummary ?? evaluation.spokenSummary,
                  fullTranscript: results?.fullTranscript,
                  evaluation,
                  questions: Array.isArray(results?.questions)
                    ? results.questions
                    : undefined,
                  source: "fulltest-v2",
                  testSessionId: results?.testSessionId,
                });
                queryClient
                  .invalidateQueries({ queryKey: ["full-test-results"] })
                  .catch(() => undefined);
              } catch (error) {
                console.error("Failed to store full test v2 result", error);
              }

              setEvaluationData({
                overallBand: results?.overallBand ?? evaluation.overallBand,
                criteria: evaluation.criteria,
                corrections: Array.isArray(evaluation.corrections)
                  ? evaluation.corrections
                  : [],
                suggestions: suggestionStrings,
                bandComparison: (evaluation as any).bandComparison,
                testPart: "full",
                durationSeconds: results?.duration,
                sessionId: results?.testSessionId,
                topic: "Full IELTS Speaking Test",
                partScores: results?.partScores,
                spokenSummary:
                  results?.spokenSummary ?? evaluation.spokenSummary,
                fullTranscript: results?.fullTranscript,
              });
              setShowEvaluation(true);
            } else {
              try {
                await resultsStorage.saveFullTestResult({
                  id: results?.testSessionId,
                  timestamp: Date.parse(results?.timestamp || "") || Date.now(),
                  durationSeconds: Number(results?.duration) || 0,
                  questions: Array.isArray(results?.questions)
                    ? results.questions
                    : undefined,
                  source: "fulltest-v2",
                  testSessionId: results?.testSessionId,
                });
                queryClient
                  .invalidateQueries({ queryKey: ["full-test-results"] })
                  .catch(() => undefined);
              } catch (error) {
                console.error(
                  "Failed to store fallback full test result",
                  error
                );
              }

              Alert.alert(
                "Test Complete!",
                "Your IELTS test has been completed. We'll process the evaluation shortly.",
                [{ text: "OK" }]
              );
            }

            handleSessionEnd();
          }}
          onExit={handleSessionEnd}
        />
      </Modal>

      {/* Part Selection Modal */}
      <PartSelectionModal
        visible={showPartSelection}
        onClose={() => setShowPartSelection(false)}
        onSelectPart={handlePartSelected}
      />

      <Modal
        visible={showVoiceUI && mode === "simulation"}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleSessionEnd}
      >
        <SimulationMode
          onEnd={(evaluationData) => {
            handleSessionEnd();
            if (evaluationData) {
              setEvaluationData(evaluationData);
              setShowEvaluation(true);
            }
          }}
        />
      </Modal>

      {/* Evaluation Results Modal */}
      <Modal
        visible={showEvaluation}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowEvaluation(false)}
      >
        {evaluationData && (
          <EvaluationResultsScreen
            overallBand={evaluationData.overallBand}
            criteria={evaluationData.criteria}
            corrections={evaluationData.corrections || []}
            suggestions={evaluationData.suggestions || []}
            onClose={() => setShowEvaluation(false)}
            onTryAgain={async () => {
              // When retrying, unmark the question so it can be used again
              if (currentTopic && selectedPart) {
                await resultsStorage.unmarkQuestion(
                  currentTopic.question,
                  selectedPart
                );
              }
              setShowEvaluation(false);
              setShowVoiceUI(true);
            }}
            // Analytics data
            userId={user?._id}
            sessionId={evaluationData.sessionId || sessionId || undefined}
            testType={
              mode === "fulltest" || mode === "fulltest-v2"
                ? "simulation"
                : mode
            }
            topic={evaluationData.topic || currentTopic?.question || undefined}
            testPart={evaluationData.testPart}
            durationSeconds={
              evaluationData.durationSeconds !== undefined
                ? evaluationData.durationSeconds
                : sessionStartTime
                ? Math.floor((Date.now() - sessionStartTime) / 1000)
                : undefined
            }
          />
        )}
      </Modal>

      {/* Subscription Plans Modal */}
      <SubscriptionPlansModal
        visible={showPlansModal}
        plans={planOptions}
        currentTier={currentPlanTier}
        loading={subscriptionConfigQuery.isLoading}
        onClose={() => setShowPlansModal(false)}
        onSelectPlan={handleSelectPlan}
      />

      {limitState && (
        <UsageLimitModal
          visible
          sessionType={limitState.sessionType}
          currentTier={limitState.currentTier}
          used={limitState.used}
          limit={limitState.limit}
          resetDate={limitState.resetDate}
          onClose={dismissLimit}
          onUpgrade={() => {
            dismissLimit();
            setShowPlansModal(true);
          }}
        />
      )}
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
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  cardDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  button: {
    marginTop: spacing.sm,
  },
  loadingContainer: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.textSecondary,
  },
  disabledText: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    fontStyle: "italic",
  },
  });
