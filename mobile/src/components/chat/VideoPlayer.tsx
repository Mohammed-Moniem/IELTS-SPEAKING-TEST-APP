import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { AVPlaybackStatus, ResizeMode, Video } from "expo-av";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../context";
import { useThemedStyles } from "../../hooks";
import type { ColorTokens } from "../../theme/tokens";
import { logger } from "../../utils/logger";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface VideoPlayerProps {
  videoUri: string;
  thumbnailUri?: string;
  visible: boolean;
  onClose: () => void;
  headers?: Record<string, string>;
}

/**
 * Full-screen video player with controls
 */
export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUri,
  thumbnailUri,
  visible,
  onClose,
  headers,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls after 3 seconds
  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      if (status && "isPlaying" in status && status.isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Reset state when video changes
  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      setShowControls(true);
      resetControlsTimeout();
    }
  }, [visible, videoUri]);

  const handlePlayPause = async () => {
    if (!videoRef.current) return;

    try {
      if (status && "isPlaying" in status) {
        if (status.isPlaying) {
          await videoRef.current.pauseAsync();
        } else {
          await videoRef.current.playAsync();
          resetControlsTimeout();
        }
      }
    } catch (error) {
      logger.warn("Error toggling play/pause", error);
    }
  };

  const handleMuteToggle = async () => {
    if (!videoRef.current) return;

    try {
      await videoRef.current.setIsMutedAsync(!isMuted);
      setIsMuted(!isMuted);
      resetControlsTimeout();
    } catch (error) {
      logger.warn("Error toggling mute", error);
    }
  };

  const handleSeek = async (value: number) => {
    if (!videoRef.current || !status || !("durationMillis" in status)) return;

    try {
      const positionMillis = value * (status.durationMillis || 0);
      await videoRef.current.setPositionAsync(positionMillis);
      resetControlsTimeout();
    } catch (error) {
      logger.warn("Error seeking video", error);
    }
  };

  const handleReplay = async () => {
    if (!videoRef.current) return;

    try {
      await videoRef.current.replayAsync();
      resetControlsTimeout();
    } catch (error) {
      logger.warn("Error replaying video", error);
    }
  };

  const handlePlaybackStatusUpdate = (playbackStatus: AVPlaybackStatus) => {
    setStatus(playbackStatus);

    if (playbackStatus.isLoaded) {
      setIsLoading(false);
    }
  };

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleTouchPlayer = () => {
    if (!showControls) {
      resetControlsTimeout();
    } else {
      setShowControls(!showControls);
    }
  };

  const renderControls = () => {
    if (!showControls) return null;

    const isPlaying = status && "isPlaying" in status && status.isPlaying;
    const hasFinished =
      status && "didJustFinish" in status && status.didJustFinish;
    const positionMillis =
      status && "positionMillis" in status ? status.positionMillis : 0;
    const durationMillis =
      status && "durationMillis" in status ? status.durationMillis || 0 : 0;
    const progress = durationMillis > 0 ? positionMillis / durationMillis : 0;

    return (
      <>
        {/* Top bar with close button */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={32} color={colors.primaryOn} />
          </TouchableOpacity>
        </View>

        {/* Center play/pause button */}
        <View style={styles.centerControls}>
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primaryOn} />
          ) : (
            <TouchableOpacity
              onPress={hasFinished ? handleReplay : handlePlayPause}
              style={styles.playButton}
            >
              <Ionicons
                name={hasFinished ? "reload" : isPlaying ? "pause" : "play"}
                size={64}
                color={colors.primaryOn}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomControls}>
          {/* Progress slider */}
          <View style={styles.progressContainer}>
            <Text style={styles.timeText}>{formatTime(positionMillis)}</Text>
            <Slider
              style={styles.slider}
              value={progress}
              minimumValue={0}
              maximumValue={1}
              minimumTrackTintColor={colors.primaryOn}
              maximumTrackTintColor={colors.textMuted}
              thumbTintColor={colors.primaryOn}
              onSlidingComplete={handleSeek}
            />
            <Text style={styles.timeText}>{formatTime(durationMillis)}</Text>
          </View>

          {/* Additional controls */}
          <View style={styles.additionalControls}>
            <TouchableOpacity
              onPress={handleMuteToggle}
              style={styles.controlButton}
            >
              <Ionicons
                name={isMuted ? "volume-mute" : "volume-high"}
                size={28}
                color={colors.primaryOn}
              />
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <StatusBar hidden />
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.videoContainer}
          activeOpacity={1}
          onPress={handleTouchPlayer}
        >
          <Video
            ref={videoRef}
            source={{ uri: videoUri, headers }}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={false}
            isLooping={false}
            isMuted={isMuted}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            onLoad={() => setIsLoading(false)}
            posterSource={
              thumbnailUri ? { uri: thumbnailUri, headers } : undefined
            }
            usePoster={!!thumbnailUri}
          />
        </TouchableOpacity>

        {renderControls()}
      </View>
    </Modal>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  videoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingHorizontal: 16,
    backgroundColor: colors.overlayBackdrop,
    flexDirection: "row",
    alignItems: "center",
  },
  closeButton: {
    padding: 8,
  },
  centerControls: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "box-none",
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.overlayBackdrop,
    justifyContent: "center",
    alignItems: "center",
  },
  bottomControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    paddingHorizontal: 16,
    backgroundColor: colors.overlayBackdrop,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  slider: {
    flex: 1,
    marginHorizontal: 12,
    height: 40,
  },
  timeText: {
    color: colors.primaryOn,
    fontSize: 12,
    fontWeight: "500",
    minWidth: 45,
    textAlign: "center",
  },
  additionalControls: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  controlButton: {
    padding: 8,
    marginLeft: 16,
  },
});

export default VideoPlayer;
