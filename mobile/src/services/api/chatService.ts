import { apiClient } from "../../api/client";

export interface ChatMessage {
  _id: string;
  conversationId: string;
  senderId: string;
  recipientId?: string;
  groupId?: string;
  content: string; // Decrypted content
  messageType: "text" | "image" | "audio" | "file";
  readBy: string[];
  deliveredTo: string[];
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  _id: string;
  conversationId: string;
  participants: Array<{
    _id: string;
    email: string;
    username?: string;
    avatar?: string;
  }>;
  isGroupChat: boolean;
  lastMessage?: {
    preview: string;
    timestamp: string;
    senderId: string;
  };
  unreadCount: number;
  groupName?: string;
}

class ChatService {
  /**
   * Get user's conversations
   */
  async getConversations(): Promise<Conversation[]> {
    const response = await apiClient.get("/chat/conversations");
    return response.data.data;
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(
    conversationId: string,
    limit: number = 50,
    before?: string
  ): Promise<ChatMessage[]> {
    const response = await apiClient.get(`/chat/messages/${conversationId}`, {
      params: { limit, before },
    });
    return response.data.data;
  }

  /**
   * Mark a message as read
   */
  async markMessageAsRead(messageId: string): Promise<{ message: string }> {
    const response = await apiClient.post(
      `/chat/messages/${messageId}/read`,
      {}
    );
    return response.data;
  }

  /**
   * Mark all messages in a conversation as read
   */
  async markConversationAsRead(
    conversationId: string
  ): Promise<{ message: string }> {
    const response = await apiClient.post(
      `/chat/conversations/${conversationId}/read`,
      {}
    );
    return response.data;
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId: string): Promise<{ message: string }> {
    const response = await apiClient.delete(`/chat/messages/${messageId}`);
    return response.data;
  }

  /**
   * Edit a message
   */
  async editMessage(
    messageId: string,
    newContent: string
  ): Promise<ChatMessage> {
    const response = await apiClient.put(`/chat/messages/${messageId}`, {
      newContent,
    });
    return response.data.data;
  }

  /**
   * Get total unread message count
   */
  async getUnreadCount(): Promise<number> {
    const response = await apiClient.get("/chat/unread");
    return response.data.data.unreadCount;
  }

  /**
   * Search messages in a conversation
   */
  async searchMessages(
    conversationId: string,
    query: string
  ): Promise<ChatMessage[]> {
    const response = await apiClient.get(`/chat/search/${conversationId}`, {
      params: { q: query },
    });
    return response.data.data;
  }
}

export default new ChatService();
