import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useTheme } from "../../context";
import { useProfile } from "../../hooks";
import { useThemedStyles } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";
import { logger } from "../../utils/logger";

export const QRCodeScreen: React.FC = () => {
  const { generateQRCode } = useProfile();
  const [qrData, setQRData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"friend" | "referral">("friend");
  const { colors, theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  useEffect(() => {
    loadQRCode("friend");
  }, []);

  const loadQRCode = async (nextMode: "friend" | "referral") => {
    setLoading(true);
    setMode(nextMode);
    const data = await generateQRCode(nextMode);
    setQRData(data);
    setLoading(false);
  };

  const handleShare = async () => {
    if (!qrData) return;

    const payload = safeParsePayload(qrData);

    const message =
      mode === "referral"
        ? payload
          ? `Join me on the IELTS Practice App! Use my referral link ${payload.referralLink ??
              ""} (code: ${payload.referralCode ?? ""}).`
          : `Join me on the IELTS Practice App!`
        : payload
        ? `Add me on IELTS Practice App! Scan this code or search for @${payload.username}`
        : `Add me on IELTS Practice App!`;

    try {
      await Share.share({
        message,
        title: mode === "referral" ? "Share Referral" : "Add Friend",
      });
    } catch (error) {
      logger.warn("QR share failed", error);
    }
  };

  const handleCopyReferral = async () => {
    if (!qrData) return;
    const payload = safeParsePayload(qrData);
    if (payload?.referralCode) {
      await Clipboard.setStringAsync(payload.referralCode);
    }
  };

  const qrPayload = useMemo(() => safeParsePayload(qrData), [qrData]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>My QR Codes</Text>
        <Text style={styles.description}>
          Share your code to add friends or invite them with referrals
        </Text>
      </View>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            mode === "friend" && styles.toggleButtonActive,
          ]}
          onPress={() => loadQRCode("friend")}
        >
          <Text
            style={[
              styles.toggleText,
              mode === "friend" && styles.toggleTextActive,
            ]}
          >
            Friends
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            mode === "referral" && styles.toggleButtonActive,
          ]}
          onPress={() => loadQRCode("referral")}
        >
          <Text
            style={[
              styles.toggleText,
              mode === "referral" && styles.toggleTextActive,
            ]}
          >
            Referrals
          </Text>
        </TouchableOpacity>
      </View>

      {loading || !qrData ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <View style={styles.qrContainer}>
            <View style={styles.qrWrapper}>
              <QRCode
                value={qrData}
                size={250}
                backgroundColor={colors.primaryOn}
                color={theme === "dark" ? colors.textInverse : colors.textPrimary}
              />
            </View>
            {mode === "referral" && qrPayload?.referralCode && (
              <Text style={styles.qrCaption}>
                Referral Code: {qrPayload.referralCode}
              </Text>
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color={colors.primaryOn} />
              <Text style={styles.shareButtonText}>
                {mode === "referral" ? "Share Invite" : "Share QR Code"}
              </Text>
            </TouchableOpacity>
            {mode === "referral" && qrPayload?.referralCode && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleCopyReferral}
              >
                <Ionicons name="copy" size={18} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>Copy Code</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color={colors.info} />
            <Text style={styles.infoText}>
              {mode === "referral"
                ? "Share this referral code with new users. They can scan it during onboarding or from the Social tab."
                : "Friends can scan this code using the QR scanner in the Social tab to send you a friend request."}
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
};

const safeParsePayload = (
  value: string | null
):
  | {
      type: string;
      username?: string;
      referralCode?: string;
      referralLink?: string;
    }
  | null => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 24,
    },
    header: {
      alignItems: "center",
      marginBottom: 32,
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    description: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: "center",
    },
    loadingContainer: {
      padding: 64,
      alignItems: "center",
    },
    toggleRow: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 16,
    },
    toggleButton: {
      flex: 1,
      backgroundColor: colors.surfaceSubtle,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
    },
    toggleButtonActive: {
      backgroundColor: colors.primary,
    },
    toggleText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    toggleTextActive: {
      color: colors.primaryOn,
    },
    qrContainer: {
      alignItems: "center",
      marginBottom: 32,
    },
    qrWrapper: {
      backgroundColor: colors.surface,
      padding: 24,
      borderRadius: 20,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    qrCaption: {
      marginTop: 12,
      fontSize: 15,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    actions: {
      marginBottom: 24,
      gap: 12,
    },
    shareButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      gap: 8,
    },
    secondaryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
      gap: 8,
      backgroundColor: colors.surface,
    },
    shareButtonText: {
      color: colors.primaryOn,
      fontSize: 17,
      fontWeight: "600",
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: "600",
    },
    infoBox: {
      flexDirection: "row",
      backgroundColor: colors.infoSoft,
      padding: 16,
      borderRadius: 12,
      gap: 12,
    },
    infoText: {
      flex: 1,
      fontSize: 15,
      color: colors.info,
      lineHeight: 20,
    },
  });
