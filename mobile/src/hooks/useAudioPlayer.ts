/**
 * useAudioPlayer Hook
 * React hook for managing audio playback state
 */

import { useCallback, useEffect, useRef, useState } from "react";
import audioPlayerService from "../services/audioPlayerService";

interface UseAudioPlayerReturn {
  // State
  isPlaying: boolean;
  isLoading: boolean;
  position: number;
  duration: number;
  currentUri: string | null;

  // Computed
  progress: number; // 0 to 1
  formattedPosition: string; // MM:SS
  formattedDuration: string; // MM:SS

  // Actions
  loadAudio: (uri: string) => Promise<boolean>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  seekTo: (positionMillis: number) => Promise<void>;
  seekToPercent: (percent: number) => Promise<void>;
  setRate: (rate: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  unload: () => Promise<void>;
}

export const useAudioPlayer = (): UseAudioPlayerReturn => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentUri, setCurrentUri] = useState<string | null>(null);

  // Track if component is mounted
  const isMountedRef = useRef(true);

  // Subscribe to playback state changes
  useEffect(() => {
    const unsubscribe = audioPlayerService.subscribe((state) => {
      if (isMountedRef.current) {
        setIsPlaying(state.isPlaying);
        setIsLoading(state.isLoading);
        setPosition(state.position);
        setDuration(state.duration);
        setCurrentUri(state.uri);
      }
    });

    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, []);

  // Load audio
  const loadAudio = useCallback(async (uri: string): Promise<boolean> => {
    return await audioPlayerService.loadAudio(uri);
  }, []);

  // Play audio
  const play = useCallback(async (): Promise<void> => {
    await audioPlayerService.play();
  }, []);

  // Pause audio
  const pause = useCallback(async (): Promise<void> => {
    await audioPlayerService.pause();
  }, []);

  // Stop audio
  const stop = useCallback(async (): Promise<void> => {
    await audioPlayerService.stop();
  }, []);

  // Seek to position
  const seekTo = useCallback(async (positionMillis: number): Promise<void> => {
    await audioPlayerService.seekTo(positionMillis);
  }, []);

  // Seek to percentage (0-100)
  const seekToPercent = useCallback(
    async (percent: number): Promise<void> => {
      if (duration > 0) {
        const positionMillis = (percent / 100) * duration;
        await audioPlayerService.seekTo(positionMillis);
      }
    },
    [duration]
  );

  // Set playback rate
  const setRate = useCallback(async (rate: number): Promise<void> => {
    await audioPlayerService.setRate(rate);
  }, []);

  // Set volume
  const setVolume = useCallback(async (volume: number): Promise<void> => {
    await audioPlayerService.setVolume(volume);
  }, []);

  // Unload audio
  const unload = useCallback(async (): Promise<void> => {
    await audioPlayerService.unloadAudio();
  }, []);

  // Calculate progress (0 to 1)
  const progress = duration > 0 ? position / duration : 0;

  // Format times
  const formattedPosition = audioPlayerService.formatTime(position);
  const formattedDuration = audioPlayerService.formatTime(duration);

  return {
    // State
    isPlaying,
    isLoading,
    position,
    duration,
    currentUri,

    // Computed
    progress,
    formattedPosition,
    formattedDuration,

    // Actions
    loadAudio,
    play,
    pause,
    stop,
    seekTo,
    seekToPercent,
    setRate,
    setVolume,
    unload,
  };
};
