import * as Application from "expo-application";
import Constants from "expo-constants";
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { supportApi } from "../../api/services";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionHeading } from "../../components/SectionHeading";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { extractErrorMessage } from "../../utils/errors";

export const HelpSupportScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const context = useMemo(() => {
    const extra = (Constants.expoConfig?.extra || {}) as Record<string, any>;
    return {
      app: {
        name: Application.applicationName,
        version: Constants.expoConfig?.version,
        nativeVersion: Application.nativeApplicationVersion,
        build: Application.nativeBuildVersion,
        env: extra.appEnv,
      },
      device: {
        platform: Platform.OS,
        platformVersion: Platform.Version,
      },
      user: {
        id: user?._id,
        isGuest: Boolean(user?.isGuest),
      },
    };
  }, [user?._id, user?.isGuest]);

  const handleSubmit = async () => {
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    if (!trimmedSubject || !trimmedMessage) {
      Alert.alert("Missing info", "Please add a subject and a message.");
      return;
    }

    setSubmitting(true);
    try {
      await supportApi.createTicket({
        subject: trimmedSubject,
        message: trimmedMessage,
        context,
      });

      setSubject("");
      setMessage("");
      Alert.alert("Sent", "Your message has been sent. We'll review it soon.");
    } catch (error) {
      Alert.alert("Unable to send", extractErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <SectionHeading title="Help & Support">
            Send feedback or report an issue directly from the app.
          </SectionHeading>

          <Card>
            <Text style={styles.label}>Subject</Text>
            <TextInput
              style={styles.input}
              placeholder="What do you need help with?"
              placeholderTextColor={colors.textMuted}
              value={subject}
              onChangeText={setSubject}
              autoCapitalize="sentences"
            />

            <View style={{ height: spacing.md }} />

            <Text style={styles.label}>Message</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Tell us what happened (steps, expected vs actual)…"
              placeholderTextColor={colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              textAlignVertical="top"
            />

            <View style={{ height: spacing.lg }} />

            <Button title="Send" onPress={handleSubmit} loading={submitting} />
          </Card>

          <Text style={styles.hint}>
            Tip: Include what screen you were on, and whether you were offline.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    content: {
      padding: spacing.md,
      paddingBottom: spacing.xxl,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "700",
      marginBottom: spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.textPrimary,
    },
    textarea: {
      minHeight: 140,
      paddingTop: spacing.md,
    },
    hint: {
      marginTop: spacing.md,
      color: colors.textMuted,
      fontSize: 12,
    },
  });

