import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  checkUsageLimit,
  getSubscriptionPlans,
  SubscriptionPlan,
  upgradeSubscription,
} from "../../api/subscriptionApi";
import { GeneratedTopic, getCachedRandomTopic } from "../../api/topicApi";
import { AuthenticFullTest } from "../../components/AuthenticFullTest";
import { AuthenticFullTestV2 } from "../../components/AuthenticFullTestV2";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { PartSelectionModal } from "../../components/PartSelectionModal";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SimulationMode } from "../../components/SimulationMode";
import { SubscriptionPlansModal } from "../../components/SubscriptionPlansModal";
import { UsageLimitModal } from "../../components/UsageLimitModal";
import { VoiceConversation } from "../../components/VoiceConversationV2";
import { resultsStorage } from "../../services/resultsStorage";
import { colors, spacing } from "../../theme/tokens";
import { EvaluationResultsScreen } from "../EvaluationResults/EvaluationResultsScreen";

// For demo purposes - in production, get this from auth context
const DEMO_USER_ID = "demo-user-123";

export const VoiceTestScreen: React.FC = () => {
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

  // Subscription state
  const [currentTier, setCurrentTier] = useState<string>("free");
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitInfo, setLimitInfo] = useState<any>(null);

  // Load subscription plans on mount
  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const subscriptionPlans = await getSubscriptionPlans();
      setPlans(subscriptionPlans);
    } catch (error) {
      console.error("Failed to load plans:", error);
    }
  };

  const startPractice = async () => {
    try {
      // Check usage limit first
      const limitCheck = await checkUsageLimit(DEMO_USER_ID, "practice");

      if (!limitCheck.allowed) {
        // Show limit modal
        setLimitInfo(limitCheck);
        setShowLimitModal(true);
        return;
      }

      // Show part selection modal
      setShowPartSelection(true);
    } catch (error: any) {
      console.error("Failed to check limit:", error);
      Alert.alert("Error", "Failed to start practice. Please try again.", [
        { text: "OK" },
      ]);
    }
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

  const startSimulation = async () => {
    try {
      // Check usage limit first
      const limitCheck = await checkUsageLimit(DEMO_USER_ID, "simulation");

      if (!limitCheck.allowed) {
        // Show limit modal
        setLimitInfo(limitCheck);
        setShowLimitModal(true);
        return;
      }

      setMode("simulation");

      // Start session tracking
      const newSessionId = `session_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      setSessionId(newSessionId);
      setSessionStartTime(Date.now());

      setShowVoiceUI(true);
    } catch (error: any) {
      console.error("Failed to check limit:", error);
      Alert.alert("Error", "Failed to start simulation. Please try again.", [
        { text: "OK" },
      ]);
    }
  };

  const startFullTest = async () => {
    try {
      // Full test uses simulation quota
      const limitCheck = await checkUsageLimit(DEMO_USER_ID, "simulation");

      if (!limitCheck.allowed) {
        setLimitInfo(limitCheck);
        setShowLimitModal(true);
        return;
      }

      setMode("fulltest");

      // Start session tracking
      const newSessionId = `fulltest_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      setSessionId(newSessionId);
      setSessionStartTime(Date.now());

      setShowVoiceUI(true);
    } catch (error: any) {
      console.error("Failed to check limit:", error);
      Alert.alert("Error", "Failed to start full test. Please try again.", [
        { text: "OK" },
      ]);
    }
  };

  const handleSessionEnd = async () => {
    setShowVoiceUI(false);
    // Note: Usage logging is handled by the backend automatically
    // through practice session completion endpoints
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

  const handleSelectPlan = async (tier: "free" | "premium" | "pro") => {
    try {
      await upgradeSubscription(DEMO_USER_ID, tier);
      setCurrentTier(tier);
      setShowPlansModal(false);

      Alert.alert(
        "Success!",
        `You've been upgraded to ${tier}. Enjoy unlimited access!`,
        [{ text: "OK" }]
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to upgrade subscription", [
        { text: "OK" },
      ]);
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
          <Text style={styles.cardTitle}>Full Test Simulation</Text>
          <Text style={styles.cardDescription}>
            Real-time conversation with AI examiner. Complete all 3 parts of
            IELTS Speaking Test.
          </Text>
          <Button
            title="Start Full Simulation"
            onPress={startSimulation}
            variant="secondary"
            style={styles.button}
            disabled={showVoiceUI || isLoadingTopic}
          />
          {(showVoiceUI || isLoadingTopic) && (
            <Text style={styles.disabledText}>
              Complete your current session first
            </Text>
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>🎯 Authentic Full Test (NEW)</Text>
          <Text style={styles.cardDescription}>
            Experience the REAL IELTS Speaking Test! No buttons, automatic flow,
            just like the actual exam. All 3 parts with strict timing.
          </Text>
          <Button
            title="Start Authentic Test"
            onPress={startFullTest}
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

        <View style={styles.features}>
          <Text style={styles.featuresTitle}>✨ New Features:</Text>
          <Text style={styles.feature}>
            • Animated voice orb (like ChatGPT)
          </Text>
          <Text style={styles.feature}>• Real-time audio recording</Text>
          <Text style={styles.feature}>• Premium dark UI design</Text>
          <Text style={styles.feature}>• Smooth animations</Text>
          <Text style={styles.feature}>• Mute/unmute controls</Text>
        </View>
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
          onComplete={(results) => {
            console.log("Full test complete:", results);
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
          onComplete={(results) => {
            console.log("Full test V2 complete:", results);
            handleSessionEnd();
            Alert.alert(
              "Test Complete!",
              "Your IELTS test has been completed. Well done!",
              [{ text: "OK" }]
            );
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
            userId={DEMO_USER_ID}
            sessionId={sessionId || undefined}
            testType={
              mode === "fulltest" || mode === "fulltest-v2"
                ? "simulation"
                : mode
            }
            topic={currentTopic?.question || undefined}
            testPart={evaluationData.testPart}
            durationSeconds={
              sessionStartTime
                ? Math.floor((Date.now() - sessionStartTime) / 1000)
                : undefined
            }
          />
        )}
      </Modal>

      {/* Subscription Plans Modal */}
      <SubscriptionPlansModal
        visible={showPlansModal}
        plans={plans}
        currentTier={currentTier}
        onClose={() => setShowPlansModal(false)}
        onSelectPlan={handleSelectPlan}
      />

      {/* Usage Limit Modal */}
      {limitInfo && (
        <UsageLimitModal
          visible={showLimitModal}
          sessionType={
            mode === "fulltest" || mode === "fulltest-v2" ? "simulation" : mode
          }
          currentTier={limitInfo.tier}
          used={limitInfo.used}
          limit={limitInfo.limit}
          resetDate={new Date(limitInfo.resetDate)}
          onClose={() => setShowLimitModal(false)}
          onUpgrade={() => {
            setShowLimitModal(false);
            setShowPlansModal(true);
          }}
        />
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
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
  features: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.backgroundMuted,
    borderRadius: 12,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  feature: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    lineHeight: 20,
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
