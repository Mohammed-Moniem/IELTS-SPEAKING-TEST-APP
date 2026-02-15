import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { accountApi } from "../../api/services";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ScreenContainer } from "../../components/ScreenContainer";
import { SectionHeading } from "../../components/SectionHeading";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import offlineStorage from "../../services/offlineStorage";
import type { ColorTokens } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { extractErrorMessage } from "../../utils/errors";

export const DataPrivacyScreen: React.FC = () => {
  const { logout } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await accountApi.export();
      const json = JSON.stringify(data, null, 2);
      const fileName = `spokio-export-${Date.now()}.json`;
      const file = new FileSystem.File(FileSystem.Paths.cache, fileName);
      file.create({ intermediates: true, overwrite: true });
      file.write(json, { encoding: "utf8" });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Export ready", `Saved to: ${file.uri}`);
        return;
      }

      await Sharing.shareAsync(file.uri, {
        UTI: "public.json",
        mimeType: "application/json",
        dialogTitle: "Spokio export",
      });
    } catch (error) {
      Alert.alert("Export failed", extractErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      "Delete account",
      "This permanently deletes your account and history. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => handleDelete(),
        },
      ]
    );
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await accountApi.delete();
      try {
        await offlineStorage.clearAll();
      } catch {}
      await logout();

      Alert.alert("Account deleted", "Your account has been deleted.");
    } catch (error) {
      Alert.alert("Delete failed", extractErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ScreenContainer scrollable>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionHeading title="Data & privacy">
          Export or delete your account from within the app.
        </SectionHeading>

        <Card>
          <Text style={styles.title}>Export my data</Text>
          <Text style={styles.desc}>
            Download a JSON export of your profile, history, favorites, and recording metadata (no raw audio).
          </Text>
          <Button title="Export" onPress={handleExport} loading={exporting} />
          <Text style={styles.smallHint}>
            File will be saved to cache and shared using your device share sheet.
          </Text>
        </Card>

        <View style={{ height: spacing.md }} />

        <Card>
          <Text style={[styles.title, { color: colors.danger }]}>Delete account</Text>
          <Text style={styles.desc}>
            Permanently delete your account and all associated data.
          </Text>
          <Button
            title={Platform.OS === "ios" ? "Delete account" : "DELETE ACCOUNT"}
            onPress={confirmDelete}
            loading={deleting}
            variant="secondary"
          />
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    content: {
      padding: spacing.md,
      paddingBottom: spacing.xxl,
    },
    title: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    desc: {
      color: colors.textSecondary,
      marginBottom: spacing.md,
      lineHeight: 20,
    },
    smallHint: {
      marginTop: spacing.sm,
      color: colors.textMuted,
      fontSize: 12,
    },
  });
