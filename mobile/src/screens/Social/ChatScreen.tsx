import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { API_KEY } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { AudioMessage } from "../../components/chat/AudioMessage";
import { GifMessage } from "../../components/chat/GifMessage";
import { GifPicker } from "../../components/chat/GifPicker";
import { ImageMessage } from "../../components/chat/ImageMessage";
import { ImageViewer } from "../../components/chat/ImageViewer";
import { OnlineStatusBadge } from "../../components/chat/OnlineStatusBadge";
import { TypingIndicator } from "../../components/chat/TypingIndicator";
import { VideoMessage } from "../../components/chat/VideoMessage";
import { useChat } from "../../hooks";
import audioRecordingService from "../../services/api/audioRecordingService";
import type { ChatMessage } from "../../services/api/chatService";
import socketService from "../../services/socketService";
import { typingIndicatorService } from "../../services/typingIndicatorService";

// Check if Giphy SDK is available
let isGiphyAvailable = false;
try {
  require("@giphy/react-native-sdk");
  isGiphyAvailable = true;
} catch (error) {
  // Giphy SDK not available (e.g., in Expo Go)
  isGiphyAvailable = false;
}

export const ChatScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { user, accessToken } = useAuth();
  const {
    conversationId,
    recipientId,
    recipientName,
    isGroupChat = false,
  } = route.params || {};

  // Log params only once on mount
  useEffect(() => {
    console.log("📊 ChatScreen params:", {
      conversationId,
      recipientId,
      recipientName,
      isGroupChat,
    });
  }, []); // Empty deps - only log once

  const resolvedConversationId = useMemo(() => {
    if (isGroupChat) {
      return (
        conversationId || (recipientId ? `group_${recipientId}` : undefined)
      );
    }

    if (conversationId) {
      return conversationId;
    }

    if (user?._id && recipientId) {
      const ids = [user._id, recipientId].sort();
      return `${ids[0]}_${ids[1]}`;
    }

    return undefined;
  }, [conversationId, isGroupChat, recipientId, user?._id]);

  const {
    messages,
    loading,
    loadingMore,
    hasMore,
    sendMessage,
    sendGroupMessage,
    loadMessages,
    markAsRead,
    loadConversations,
    loadUnreadCount,
    addOptimisticMessage,
    updateMessage,
  } = useChat(resolvedConversationId);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = {
      "x-api-key": API_KEY,
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    return headers;
  }, [accessToken]);

  const refreshConversation = useCallback(
    async (conversationId?: string) => {
      const targetId = conversationId || resolvedConversationId;

      if (targetId) {
        await loadMessages(targetId, true);
      }

      await Promise.all([loadConversations(), loadUnreadCount()]);
    },
    [loadConversations, loadMessages, loadUnreadCount, resolvedConversationId]
  );

  // Join/leave group room when in group chat mode
  useEffect(() => {
    if (isGroupChat && recipientId) {
      console.log("🔗 Joining group room:", recipientId);
      socketService.joinGroup(recipientId);

      return () => {
        console.log("🚪 Leaving group room:", recipientId);
        socketService.leaveGroup(recipientId);
      };
    }
  }, [isGroupChat, recipientId]);

  useEffect(() => {
    if (resolvedConversationId) {
      loadMessages(resolvedConversationId, true);
    }

    // Set header with online status
    navigation.setOptions({
      headerTitle: () => (
        <View style={{ flexDirection: "column", alignItems: "center" }}>
          <Text style={{ fontSize: 17, fontWeight: "600", color: "#000" }}>
            {recipientName || "Chat"}
          </Text>
          {recipientId && !isGroupChat && (
            <OnlineStatusBadge userId={recipientId} showText size="small" />
          )}
        </View>
      ),
    });
  }, [
    resolvedConversationId,
    recipientId,
    recipientName,
    isGroupChat,
    navigation,
    loadMessages,
  ]);

  // Debug messages state
  useEffect(() => {
    console.log("📊 ChatScreen messages state:", {
      count: messages.length,
      loading,
      resolvedConversationId,
      firstMessageId: messages[0]?._id,
      messageIds: messages.map((m) => m._id),
    });
  }, [messages, loading, resolvedConversationId]);

  // Mark messages as read
  useEffect(() => {
    if (!user?._id || messages.length === 0 || !resolvedConversationId) {
      return;
    }

    messages.forEach((msg) => {
      if (!msg.readBy.includes(user._id) && msg.senderId !== user._id) {
        markAsRead(msg._id);
      }
    });
  }, [messages, resolvedConversationId, markAsRead, user?._id]);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;

    const text = inputText.trim();
    setInputText("");
    setSending(true);

    try {
      if (isGroupChat) {
        await sendGroupMessage(recipientId, text, "text");
      } else {
        await sendMessage(recipientId, text, "text");
      }
      await refreshConversation();
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (text: string) => {
    setInputText(text);

    if (resolvedConversationId) {
      // Send typing indicator via service
      typingIndicatorService.sendTypingIndicator(resolvedConversationId, true);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        typingIndicatorService.sendTypingIndicator(
          resolvedConversationId,
          false
        );
      }, 2000);
    }
  };

  // const handleAttachment = async () => {
  //   const options: any[] = [
  //     {
  //       text: "Video",
  //       onPress: handleVideoSelection,
  //     },
  //   ];
  //
  //   // Only show GIF option if SDK is available
  //    if (isGiphyAvailable) {
  //     options.push({
  //       text: "GIF",
  //       onPress: () => setShowGifPicker(true),
  //     });
  //   }
  //
  //   options.push({
  //     text: "Cancel",
  //     style: "cancel",
  //   });
  //
  //   Alert.alert("Send Media", "Choose an option", options);
  // };

  // const handlePhotoSelection = async () => {
  //   Alert.alert("Send Photo", "Choose source", [
  //     {
  //       text: "Photo Library",
  //       onPress: async () => {
  //         const tempId = `temp_${Date.now()}`;
  //         try {
  //
  //           // Pick image
  //           const pickedMedia = await mediaUploadService.pickImageFromGallery();
  //           if (!pickedMedia) {
  //             return; // User canceled
  //           }
  //
  //           // Compress image
  //           const compressedUri = await mediaUploadService.compressImage(
  //             pickedMedia.uri
  //           );
  //           const compressedMedia = { ...pickedMedia, uri: compressedUri };
  //
  //           setUploadingImages(new Map(uploadingImages.set(tempId, 0)));
  //
  //           // Send with progress tracking
  //           const uploadResult = await mediaUploadService.sendImageMessage(
  //             resolvedConversationId || recipientId,
  //             compressedMedia,
  //             undefined, // No caption for now
  //             (progress) => {
  //               setUploadingImages(
  //                 new Map(uploadingImages.set(tempId, progress.percentage))
  //               );
  //             }
  //           );
  //
  //           await refreshConversation(uploadResult?.message?.conversationId);
  //         } catch (error) {
  //           console.error("Failed to send image:", error);
  //           Alert.alert("Error", "Failed to send image. Please try again.");
  //         } finally {
  //           setUploadingImages((prev) => {
  //             const newMap = new Map(prev);
  //             newMap.delete(tempId);
  //             return newMap;
  //           });
  //         }
  //       },
  //     },
  //     {
  //       text: "Camera",
  //       onPress: async () => {
  //         const tempId = `temp_${Date.now()}`;
  //         try {
  //
  //           // Take photo
  //           const pickedMedia = await mediaUploadService.takePhoto();
  //           if (!pickedMedia) {
  //             return; // User canceled
  //           }
  //
  //           // Compress image
  //           const compressedUri = await mediaUploadService.compressImage(
  //             pickedMedia.uri
  //           );
  //           const compressedMedia = { ...pickedMedia, uri: compressedUri };
  //
  //           setUploadingImages(new Map(uploadingImages.set(tempId, 0)));
  //
  //           // Send with progress tracking
  //           const uploadResult = await mediaUploadService.sendImageMessage(
  //             resolvedConversationId || recipientId,
  //             compressedMedia,
  //             undefined, // No caption for now
  //             (progress) => {
  //               setUploadingImages(
  //                 new Map(uploadingImages.set(tempId, progress.percentage))
  //               );
  //             }
  //           );
  //
  //           await refreshConversation(uploadResult?.message?.conversationId);
  //         } catch (error) {
  //           console.error("Failed to send image:", error);
  //           Alert.alert("Error", "Failed to send image. Please try again.");
  //         } finally {
  //           setUploadingImages((prev) => {
  //             const newMap = new Map(prev);
  //             newMap.delete(tempId);
  //             return newMap;
  //           });
  //         }
  //       },
  //     },
  //     {
  //       text: "Cancel",
  //       style: "cancel",
  //     },
  //   ]);
  // };

  // const handleVideoSelection = async () => {
  //   Alert.alert("Send Video", "Choose source", [
  //     {
  //       text: "Video Library",
  //       onPress: async () => {
  //         const tempId = `temp_${Date.now()}`;
  //         try {
  //
  //           // Pick video
  //           const video = await videoRecordingService.pickVideo();
  //           if (!video) {
  //             return; // User canceled
  //           }
  //
  //           setUploadingVideos(new Map(uploadingVideos.set(tempId, 0)));
  //
  //           // Send with progress tracking
  //           const uploadResult = await videoRecordingService.sendVideoMessage(
  //             video,
  //             resolvedConversationId || recipientId,
  //             recipientId,
  //             (progress) => {
  //               setUploadingVideos(
  //                 new Map(uploadingVideos.set(tempId, progress.percentage))
  //               );
  //             }
  //           );
  //
  //           await refreshConversation(uploadResult?.message?.conversationId);
  //         } catch (error) {
  //           console.error("Failed to send video:", error);
  //           Alert.alert("Error", "Failed to send video. Please try again.");
  //         } finally {
  //           setUploadingVideos((prev) => {
  //             const newMap = new Map(prev);
  //             newMap.delete(tempId);
  //             return newMap;
  //           });
  //         }
  //       },
  //     },
  //     {
  //       text: "Record Video",
  //       onPress: async () => {
  //         const tempId = `temp_${Date.now()}`;
  //         try {
  //
  //           // Record video
  //           const video = await videoRecordingService.recordVideo();
  //           if (!video) {
  //             return; // User canceled
  //           }
  //
  //           setUploadingVideos(new Map(uploadingVideos.set(tempId, 0)));
  //
  //           // Send with progress tracking
  //           const uploadResult = await videoRecordingService.sendVideoMessage(
  //             video,
  //             resolvedConversationId || recipientId,
  //             recipientId,
  //             (progress) => {
  //               setUploadingVideos(
  //                 new Map(uploadingVideos.set(tempId, progress.percentage))
  //               );
  //             }
  //           );
  //
  //           await refreshConversation(uploadResult?.message?.conversationId);
  //         } catch (error) {
  //           console.error("Failed to send video:", error);
  //           Alert.alert("Error", "Failed to send video. Please try again.");
  //         } finally {
  //           setUploadingVideos((prev) => {
  //             const newMap = new Map(prev);
  //             newMap.delete(tempId);
  //             return newMap;
  //           });
  //         }
  //       },
  //     },
  //     {
  //       text: "Cancel",
  //       style: "cancel",
  //     },
  //   ]);
  // };

  const handleGifSelection = async (
    gifUrl: string,
    width: number,
    height: number
  ) => {
    try {
      // For GIF, we send directly with the URL (no upload needed)
      if (isGroupChat) {
        await sendGroupMessage(recipientId, gifUrl, "gif");
      } else {
        await sendMessage(recipientId, gifUrl, "gif");
      }
      setShowGifPicker(false);
      await refreshConversation();
    } catch (error) {
      console.error("Failed to send GIF:", error);
      Alert.alert("Error", "Failed to send GIF. Please try again.");
    }
  };

  const handleVoiceRecordStart = () => {
    setIsRecordingVoice(true);
  };

  const handleVoiceRecordCancel = () => {
    setIsRecordingVoice(false);
  };

  const handleVoiceRecordSend = async (audioUri: string, duration: number) => {
    const tempId = `temp_audio_${Date.now()}`;
    try {
      setIsRecordingVoice(false);

      const now = new Date().toISOString();
      const currentUserId = user?._id ?? "";
      const optimisticMessage: ChatMessage = {
        _id: tempId,
        conversationId:
          resolvedConversationId ||
          (currentUserId && recipientId
            ? [currentUserId, recipientId].sort().join("_")
            : ""),
        senderId: currentUserId,
        recipientId: isGroupChat ? undefined : recipientId,
        groupId: isGroupChat ? recipientId : undefined,
        content: "",
        messageType: "audio",
        mediaUrl: audioUri,
        metadata: {
          duration,
        },
        readBy: currentUserId ? [currentUserId] : [],
        deliveredTo: [],
        isEdited: false,
        isDeleted: false,
        uploadProgress: 0,
        status: "uploading",
        createdAt: now,
        updatedAt: now,
        timestamp: now,
      };

      addOptimisticMessage(optimisticMessage);

      // Upload audio with progress
      const uploadResult = await audioRecordingService.sendAudioMessage(
        resolvedConversationId || recipientId,
        audioUri,
        duration,
        (progress) => {
          updateMessage(tempId, {
            uploadProgress: progress.percentage,
            status: "uploading",
          });
        }
      );

      updateMessage(tempId, {
        status: "uploaded",
        uploadProgress: 100,
      });

      console.log("🎙️ Voice note uploaded:", uploadResult?.message?._id);

      await refreshConversation(uploadResult?.message?.conversationId);
    } catch (error) {
      console.error("Failed to send voice note:", error);
      Alert.alert("Error", "Failed to send voice note. Please try again.");
      setIsRecordingVoice(false);
      // Flag optimistic message as failed so user can retry or see status
      updateMessage(tempId, {
        status: "failed",
        uploadError: "Upload failed",
      });
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${hours % 12 || 12}:${minutes.toString().padStart(2, "0")} ${
      hours >= 12 ? "PM" : "AM"
    }`;
  };

  const formatDateSeparator = (timestamp: string) => {
    const messageDate = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Reset time parts for comparison
    const messageDateOnly = new Date(
      messageDate.getFullYear(),
      messageDate.getMonth(),
      messageDate.getDate()
    );
    const todayDateOnly = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const yesterdayDateOnly = new Date(
      yesterday.getFullYear(),
      yesterday.getMonth(),
      yesterday.getDate()
    );

    if (messageDateOnly.getTime() === todayDateOnly.getTime()) {
      return "Today";
    } else if (messageDateOnly.getTime() === yesterdayDateOnly.getTime()) {
      return "Yesterday";
    } else {
      // Format as "December 19, 2024"
      return messageDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
  };

  const shouldShowDateSeparator = (
    currentMessage: ChatMessage,
    previousMessage?: ChatMessage
  ) => {
    if (!previousMessage) return true; // Always show for first message

    const currentDate = new Date(currentMessage.createdAt);
    const previousDate = new Date(previousMessage.createdAt);

    // Compare just the date parts (ignore time)
    return (
      currentDate.getDate() !== previousDate.getDate() ||
      currentDate.getMonth() !== previousDate.getMonth() ||
      currentDate.getFullYear() !== previousDate.getFullYear()
    );
  };

  const renderDateSeparator = (date: string) => (
    <View style={styles.dateSeparatorContainer}>
      <View style={styles.dateSeparatorBadge}>
        <Text style={styles.dateSeparatorText}>{date}</Text>
      </View>
    </View>
  );

  const renderMessage = ({
    item,
    index,
  }: {
    item: ChatMessage;
    index: number;
  }) => {
    // Use the authenticated user's ID to determine if message is own
    const currentUserId = user?._id ?? "";
    const isOwnMessage =
      currentUserId !== "" && item.senderId === currentUserId;
    const showTimestamp = true; // Could be more sophisticated

    // Check if we need to show a date separator before this message
    const previousMessage =
      index < messages.length - 1 ? messages[index + 1] : undefined;
    const showDateSeparator = shouldShowDateSeparator(item, previousMessage);

    // Check if this is an image message
    if (item.messageType === "image" && item.mediaUrl) {
      return (
        <>
          {showDateSeparator &&
            renderDateSeparator(formatDateSeparator(item.createdAt))}
          <View
            style={[
              styles.messageContainer,
              isOwnMessage && styles.ownMessageContainer,
            ]}
          >
            <ImageMessage
              mediaUrl={item.mediaUrl}
              thumbnailUrl={item.thumbnailUrl}
              isOwnMessage={!!isOwnMessage}
              width={item.metadata?.width}
              height={item.metadata?.height}
              uploadProgress={item.uploadProgress}
              uploadError={item.uploadError}
              onPress={() => setViewingImage(item.mediaUrl || null)}
              headers={authHeaders}
            />
          </View>
        </>
      );
    }

    // Check if this is an audio message
    if (item.messageType === "audio" && item.mediaUrl) {
      return (
        <>
          {showDateSeparator &&
            renderDateSeparator(formatDateSeparator(item.createdAt))}
          <View
            style={[
              styles.messageContainer,
              isOwnMessage && styles.ownMessageContainer,
            ]}
          >
            <AudioMessage
              mediaUrl={item.mediaUrl}
              duration={item.metadata?.duration}
              isOwnMessage={!!isOwnMessage}
              headers={authHeaders}
              uploadProgress={item.uploadProgress}
              uploadError={item.uploadError}
              status={item.status}
            />
          </View>
        </>
      );
    }

    // Check if this is a video message
    if (item.messageType === "video" && item.mediaUrl) {
      return (
        <>
          {showDateSeparator &&
            renderDateSeparator(formatDateSeparator(item.createdAt))}
          <View
            style={[
              styles.messageContainer,
              isOwnMessage && styles.ownMessageContainer,
            ]}
          >
            <VideoMessage
              videoUrl={item.mediaUrl}
              thumbnailUrl={item.thumbnailUrl}
              duration={item.metadata?.duration}
              width={item.metadata?.width}
              height={item.metadata?.height}
              isOwnMessage={!!isOwnMessage}
              timestamp={new Date(item.createdAt)}
              headers={authHeaders}
            />
          </View>
        </>
      );
    }

    // Check if this is a GIF message
    if (item.messageType === "gif" && item.mediaUrl) {
      return (
        <>
          {showDateSeparator &&
            renderDateSeparator(formatDateSeparator(item.createdAt))}
          <View
            style={[
              styles.messageContainer,
              isOwnMessage && styles.ownMessageContainer,
            ]}
          >
            <GifMessage
              gifUrl={item.mediaUrl}
              width={item.metadata?.width}
              height={item.metadata?.height}
              isOwnMessage={!!isOwnMessage}
              timestamp={new Date(item.createdAt)}
              headers={authHeaders}
            />
          </View>
        </>
      );
    }

    return (
      <>
        {showDateSeparator &&
          renderDateSeparator(formatDateSeparator(item.createdAt))}
        <View
          style={[
            styles.messageContainer,
            isOwnMessage && styles.ownMessageContainer,
          ]}
        >
          <View
            style={[
              styles.messageBubble,
              isOwnMessage ? styles.ownMessage : styles.otherMessage,
            ]}
          >
            {/* Message tail using border trick */}
            <View
              style={[
                styles.tail,
                isOwnMessage ? styles.ownTail : styles.otherTail,
              ]}
            />

            <Text
              style={[
                styles.messageText,
                isOwnMessage && styles.ownMessageText,
              ]}
            >
              {item.content}
              {/* Add spacing for timestamp */}
              <Text style={styles.timestampSpacing}>{"        "}</Text>
            </Text>

            {/* Timestamp positioned absolutely inside bubble */}
            <View
              style={[
                styles.timestampContainer,
                isOwnMessage && styles.ownTimestampContainer,
              ]}
            >
              <Text
                style={[styles.timestamp, isOwnMessage && styles.ownTimestamp]}
              >
                {formatTimestamp(item.createdAt)}
              </Text>
              {isOwnMessage && (
                <Text style={styles.readReceipt}>
                  {(item.readBy?.length || 0) > 1 ? "✓✓" : "✓"}
                </Text>
              )}
            </View>
          </View>
        </View>
      </>
    );
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && resolvedConversationId) {
      loadMessages(resolvedConversationId, false);
    }
  };

  const handleRefresh = async () => {
    if (!resolvedConversationId || refreshing) {
      return;
    }

    try {
      setRefreshing(true);
      await loadMessages(resolvedConversationId, true);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {loading && messages.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item._id}
          inverted
          contentContainerStyle={styles.messagesList}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#007AFF"
            />
          }
          ListHeaderComponent={
            resolvedConversationId ? (
              <TypingIndicator
                conversationId={resolvedConversationId}
                currentUserId={user?._id}
              />
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                size="small"
                color="#007AFF"
                style={{ marginVertical: 10 }}
              />
            ) : null
          }
        />
      )}

      {/* Show Voice Recorder when recording */}
      {/* VOICE RECORDING TEMPORARILY DISABLED - Will be fixed later */}
      {/* {isRecordingVoice ? (
        <VoiceRecorder
          onSend={handleVoiceRecordSend}
          onCancel={handleVoiceRecordCancel}
        />
      ) : ( */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={handleTyping}
          placeholder="Message..."
          placeholderTextColor="#8E8E93"
          multiline
          maxLength={2000}
        />

        {/* Show send button always (mic button disabled for now) */}
        {/* VOICE RECORDING TEMPORARILY DISABLED - Will be fixed later */}
        {/* {inputText.trim() ? ( */}
        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSend}
          disabled={sending || !inputText.trim()}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
        {/* ) : (
            <TouchableOpacity
              style={styles.micButton}
              onPress={handleVoiceRecordStart}
            >
              <Ionicons name="mic" size={24} color="#128C7E" />
            </TouchableOpacity>
          )} */}
      </View>
      {/* )} */}

      {/* Image Viewer Modal */}
      <ImageViewer
        visible={!!viewingImage}
        imageUrl={viewingImage || ""}
        onClose={() => setViewingImage(null)}
        headers={authHeaders}
      />

      {/* GIF Picker Modal */}
      <GifPicker
        visible={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelectGif={handleGifSelection}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E5DDD5", // WhatsApp-style light background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  messagesList: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  messageContainer: {
    marginVertical: 2,
    maxWidth: "80%",
    position: "relative",
  },
  ownMessageContainer: {
    alignSelf: "flex-end",
  },
  messageBubble: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 20, // Extra space for timestamp
    position: "relative",
    // Shadow for depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.5,
    elevation: 2,
  },
  ownMessage: {
    backgroundColor: "#DCF8C6", // WhatsApp green for sent messages
  },
  otherMessage: {
    backgroundColor: "#FFFFFF", // White for received messages
  },
  // Message tail using border trick
  tail: {
    position: "absolute",
    width: 0,
    height: 0,
    borderStyle: "solid",
    bottom: 0,
  },
  ownTail: {
    right: -5,
    borderWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#DCF8C6", // Match own message background
    borderBottomColor: "transparent",
    transform: [{ rotate: "45deg" }],
  },
  otherTail: {
    left: -5,
    borderWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#FFFFFF", // Match other message background
    borderBottomColor: "transparent",
    transform: [{ rotate: "-45deg" }],
  },
  messageText: {
    fontSize: 16,
    color: "#000000",
    lineHeight: 22,
  },
  ownMessageText: {
    color: "#000000", // Dark text on green background
  },
  timestampSpacing: {
    fontSize: 11,
    opacity: 0, // Invisible but takes up space
  },
  timestampContainer: {
    position: "absolute",
    bottom: 4,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  ownTimestampContainer: {
    // Can customize if needed
  },
  timestamp: {
    fontSize: 11,
    color: "#667781", // WhatsApp timestamp gray
    marginRight: 3,
  },
  ownTimestamp: {
    color: "#667781", // Same color for both
  },
  readReceipt: {
    fontSize: 14,
    color: "#4FC3F7", // Blue checkmarks for read
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    backgroundColor: "#F0F0F0",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#C7C7CC",
  },
  input: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    maxHeight: 100,
    color: "#000000",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#128C7E", // WhatsApp green
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  micButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    borderWidth: 1,
    borderColor: "#128C7E",
  },
  // Date separator styles
  dateSeparatorContainer: {
    alignItems: "center",
    marginVertical: 12,
  },
  dateSeparatorBadge: {
    backgroundColor: "rgba(225, 245, 254, 0.92)", // Light blue with transparency
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  dateSeparatorText: {
    fontSize: 13,
    color: "#54656F", // WhatsApp date separator text color
    fontWeight: "500",
    letterSpacing: 0.2,
  },
});
