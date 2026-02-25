/**
 * Audio Player Component
 * Displays audio playback controls with progress bar
 */

import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../context";
import { useThemedStyles } from "../hooks";
import type { ColorTokens } from "../theme/tokens";
import { useAudioPlayer } from "../hooks/useAudioPlayer";

interface AudioPlayerProps {
  /** Audio file URI to play */
  uri: string;
  /** Show playback speed controls */
  showSpeedControl?: boolean;
  /** Show volume control */
  showVolumeControl?: boolean;
  /** Auto-play when loaded */
  autoPlay?: boolean;
  /** Custom styles */
  style?: any;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  uri,
  showSpeedControl = true,
  showVolumeControl = false,
  autoPlay = false,
  style,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const {
    isPlaying,
    isLoading,
    position,
    duration,
    progress,
    formattedPosition,
    formattedDuration,
    loadAudio,
    play,
    pause,
    stop,
    seekToPercent,
    setRate,
    setVolume,
    unload,
  } = useAudioPlayer();

  const [playbackRate, setPlaybackRate] = React.useState(1.0);
  const [volume, setVolumeState] = React.useState(1.0);

  // Load audio when URI changes
  useEffect(() => {
    const load = async () => {
      const success = await loadAudio(uri);
      if (success && autoPlay) {
        await play();
      }
    };

    load();

    return () => {
      unload();
    };
  }, [uri]);

  // Handle play/pause toggle
  const handlePlayPause = async () => {
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  };

  // Handle stop/reset
  const handleStop = async () => {
    await stop();
  };

  // Handle seek
  const handleSeek = async (value: number) => {
    await seekToPercent(value * 100);
  };

  // Handle playback speed change
  const handleSpeedChange = async (rate: number) => {
    setPlaybackRate(rate);
    await setRate(rate);
  };

  // Handle volume change
  const handleVolumeChange = async (vol: number) => {
    setVolumeState(vol);
    await setVolume(vol);
  };

  // Playback speed options
  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <View style={[styles.container, style]}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <Text style={styles.timeText}>{formattedPosition}</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          value={progress}
          onSlidingComplete={handleSeek}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.borderMuted}
          thumbTintColor={colors.primary}
          disabled={isLoading || duration === 0}
        />
        <Text style={styles.timeText}>{formattedDuration}</Text>
      </View>

      {/* Playback Controls */}
      <View style={styles.controlsContainer}>
        {/* Stop/Reset Button */}
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleStop}
          disabled={isLoading}
        >
          <Ionicons
            name="refresh"
            size={24}
            color={isLoading ? colors.textMuted : colors.textPrimary}
          />
        </TouchableOpacity>

        {/* Play/Pause Button */}
        <TouchableOpacity
          style={[styles.controlButton, styles.playButton]}
          onPress={handlePlayPause}
          disabled={isLoading}
        >
          {isLoading ? (
            <Text style={styles.loadingText}>...</Text>
          ) : isPlaying ? (
            <Ionicons name="pause" size={32} color={colors.primaryOn} />
          ) : (
            <Ionicons name="play" size={32} color={colors.primaryOn} />
          )}
        </TouchableOpacity>

        {/* Volume Control */}
        {showVolumeControl && (
          <View style={styles.volumeContainer}>
            <Ionicons name="volume-medium" size={20} color={colors.textPrimary} />
            <Slider
              style={styles.volumeSlider}
              minimumValue={0}
              maximumValue={1}
              value={volume}
              onSlidingComplete={handleVolumeChange}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.borderMuted}
              thumbTintColor={colors.primary}
            />
          </View>
        )}
      </View>

      {/* Speed Control */}
      {showSpeedControl && (
        <View style={styles.speedContainer}>
          <Text style={styles.speedLabel}>Speed:</Text>
          {speedOptions.map((rate) => (
            <TouchableOpacity
              key={rate}
              style={[
                styles.speedButton,
                playbackRate === rate && styles.speedButtonActive,
              ]}
              onPress={() => handleSpeedChange(rate)}
              disabled={isLoading}
            >
              <Text
                style={[
                  styles.speedButtonText,
                  playbackRate === rate && styles.speedButtonTextActive,
                ]}
              >
                {rate}x
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  slider: {
    flex: 1,
    marginHorizontal: 12,
    height: 40,
  },
  timeText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "500",
    width: 45,
    textAlign: "center",
  },
  controlsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    borderWidth: 0,
  },
  loadingText: {
    fontSize: 24,
    color: colors.primaryOn,
    fontWeight: "bold",
  },
  volumeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 16,
  },
  volumeSlider: {
    width: 80,
    marginLeft: 8,
  },
  speedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
  },
  speedLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
    marginRight: 8,
  },
  speedButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.surface,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  speedButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  speedButtonText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  speedButtonTextActive: {
    color: colors.primaryOn,
  },
});
