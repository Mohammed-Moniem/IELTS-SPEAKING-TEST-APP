import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Clipboard from "expo-clipboard";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import friendService from "../../services/api/friendService";
import { ResolvedQRCode } from "../../services/api/profileService";
import { useProfile } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";

export const QRCodeScannerScreen: React.FC = () => {
  const navigation = useNavigation();
  const { resolveQRCode } = useProfile();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [resolved, setResolved] = useState<ResolvedQRCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const requestCameraPermission = useCallback(async () => {
    const response = await requestPermission();
    if (!response?.granted) {
      Alert.alert(
        "Camera permission required",
        "We need camera access to scan QR codes. Please enable it in your device settings.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open Settings",
            onPress: () => Linking.openSettings(),
          },
        ]
      );
    }
  }, [requestPermission]);

  const handleBarcodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (processing || !scanning) {
        return;
      }

      setProcessing(true);

      try {
        const result = await resolveQRCode(data);
        if (!result) {
          throw new Error("Unable to resolve this QR code");
        }
        setResolved(result);
        setScanning(false);
        setError(null);
      } catch (err: any) {
        setError(err?.message || "Invalid QR code");
      } finally {
        setProcessing(false);
      }
    },
    [processing, scanning, resolveQRCode]
  );

  const handleSendFriendRequest = async () => {
    if (!resolved || resolved.type !== "friend_invite") {
      return;
    }

    setActionLoading(true);
    try {
      await friendService.sendFriendRequest(resolved.user.userId);
      Alert.alert("Request Sent", "Friend request sent successfully.");
      setResolved({
        ...resolved,
        status: {
          isFriend: false,
          hasPendingRequest: true,
          pendingDirection: "outgoing",
        },
      });
    } catch (err: any) {
      Alert.alert(
        "Unable to send request",
        err?.response?.data?.message || err?.message || "Unknown error"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyReferral = async () => {
    if (!resolved || resolved.type !== "referral") {
      return;
    }
    await Clipboard.setStringAsync(resolved.referralCode);
    Alert.alert("Copied", "Referral code copied to clipboard.");
  };

  const handleOpenReferralLink = async () => {
    if (!resolved || resolved.type !== "referral" || !resolved.referralLink) {
      return;
    }
    const supported = await Linking.canOpenURL(resolved.referralLink);
    if (supported) {
      await Linking.openURL(resolved.referralLink);
    } else {
      Alert.alert("Link unavailable", resolved.referralLink);
    }
  };

  const resetScanner = () => {
    setResolved(null);
    setError(null);
    setScanning(true);
  };

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera" size={48} color={colors.primary} />
        <Text style={styles.permissionTitle}>Camera Access Needed</Text>
        <Text style={styles.permissionDescription}>
          We use your camera to scan QR codes for friends and referrals.
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestCameraPermission}
        >
          <Text style={styles.permissionButtonText}>Enable Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {scanning ? (
        <>
          <CameraView
            style={styles.camera}
            facing="back"
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          >
            <View style={styles.cameraOverlay}>
              <Text style={styles.cameraInstruction}>
                Align the QR code within the frame
              </Text>
              {processing && (
                <View style={styles.cameraProcessing}>
                  <ActivityIndicator size="large" color={colors.primaryOn} />
                  <Text style={styles.cameraProcessingText}>Processing…</Text>
                </View>
              )}
            </View>
          </CameraView>
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="warning" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </>
      ) : resolved ? (
        <View style={styles.resultContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          {resolved.type === "friend_invite" ? (
            <View style={styles.resultContent}>
              <Ionicons
                name="person-add"
                size={44}
                color={colors.primary}
                style={styles.resultIcon}
              />
              <Text style={styles.resultTitle}>
                Add @{resolved.user.username}
              </Text>
              <Text style={styles.resultSubtitle}>
                {resolved.status.isFriend
                  ? "You are already friends."
                  : resolved.status.pendingDirection === "outgoing"
                  ? "Friend request already sent."
                  : resolved.status.pendingDirection === "incoming"
                  ? "There's a pending request from this user."
                  : "Send a friend request instantly."}
              </Text>

              {!resolved.status.isFriend &&
                resolved.status.pendingDirection !== "outgoing" && (
                  <TouchableOpacity
                    style={styles.primaryAction}
                    onPress={handleSendFriendRequest}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <ActivityIndicator size="small" color={colors.primaryOn} />
                    ) : (
                      <>
                        <Ionicons
                          name="paper-plane"
                          size={18}
                          color={colors.primaryOn}
                        />
                        <Text style={styles.primaryActionText}>
                          Send Friend Request
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={resetScanner}
              >
                <Text style={styles.secondaryActionText}>Scan Another</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.resultContent}>
              <Ionicons
                name="gift"
                size={44}
                color={colors.warning}
                style={styles.resultIcon}
              />
              <Text style={styles.resultTitle}>
                Referral from @{resolved.referrer.username}
              </Text>
              <Text style={styles.resultSubtitle}>
                Share this code or link with new users to help them sign up.
              </Text>

              <View style={styles.referralBox}>
                <Text style={styles.referralLabel}>Referral Code</Text>
                <Text style={styles.referralCode}>{resolved.referralCode}</Text>
              </View>

              {resolved.referralLink && (
                <TouchableOpacity
                  style={styles.primaryAction}
                  onPress={handleOpenReferralLink}
                >
                  <Ionicons name="link" size={18} color={colors.primaryOn} />
                  <Text style={styles.primaryActionText}>Open Referral Link</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={handleCopyReferral}
              >
                <Ionicons name="copy" size={16} color={colors.primary} />
                <Text style={styles.secondaryActionText}>Copy Code</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={resetScanner}
              >
                <Text style={styles.secondaryActionText}>Scan Another</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionDescription}>
            Something went wrong. Try scanning again.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={resetScanner}>
            <Text style={styles.permissionButtonText}>Restart Scanner</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  camera: {
    flex: 1,
    position: "relative",
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 80,
    backgroundColor: colors.overlayBackdrop,
  },
  cameraInstruction: {
    color: colors.primaryOn,
    fontSize: 16,
    marginBottom: 12,
  },
  cameraProcessing: {
    alignItems: "center",
    gap: 8,
  },
  cameraProcessingText: {
    color: colors.primaryOn,
    fontSize: 14,
  },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "600",
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: colors.backgroundMuted,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  permissionDescription: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: "center",
  },
  permissionButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: colors.primaryOn,
    fontSize: 16,
    fontWeight: "600",
  },
  resultContainer: {
    flex: 1,
    backgroundColor: colors.backgroundMuted,
    padding: 24,
  },
  closeButton: {
    alignSelf: "flex-end",
  },
  resultContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  resultIcon: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 32,
  },
  resultTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  resultSubtitle: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  primaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    minWidth: 220,
  },
  primaryActionText: {
    color: colors.primaryOn,
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    minWidth: 200,
  },
  secondaryActionText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "600",
  },
  referralBox: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    gap: 8,
    minWidth: 220,
  },
  referralLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  referralCode: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.textPrimary,
  },
  });
