import { useCallback, useEffect, useState } from "react";
import friendService, {
  Friend,
  FriendRequest,
  FriendSuggestion,
  UserSearchResult,
} from "../services/api/friendService";
import socketService from "../services/socketService";

export const useFriends = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFriends = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await friendService.getFriends();
      setFriends(data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load friends");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPendingRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await friendService.getPendingRequests();
      setPendingRequests(data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSentRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await friendService.getSentRequests();
      setSentRequests(data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load sent requests");
    } finally {
      setLoading(false);
    }
  }, []);

  const sendFriendRequest = useCallback(
    async (recipientId: string, message?: string) => {
      try {
        setLoading(true);
        setError(null);
        await friendService.sendFriendRequest(recipientId, message);
        await loadSentRequests();
        return true;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to send request");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [loadSentRequests]
  );

  const acceptRequest = useCallback(
    async (requestId: string) => {
      try {
        setLoading(true);
        setError(null);
        await friendService.acceptFriendRequest(requestId);
        await Promise.all([loadFriends(), loadPendingRequests()]);
        return true;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to accept request");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [loadFriends, loadPendingRequests]
  );

  const declineRequest = useCallback(
    async (requestId: string) => {
      try {
        setLoading(true);
        setError(null);
        await friendService.declineFriendRequest(requestId);
        await loadPendingRequests();
        return true;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to decline request");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [loadPendingRequests]
  );

  const cancelSentRequest = useCallback(
    async (requestId: string) => {
      try {
        setLoading(true);
        setError(null);
        await friendService.declineFriendRequest(requestId);
        await loadSentRequests();
        return true;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to cancel request");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [loadSentRequests]
  );

  const removeFriend = useCallback(
    async (friendId: string) => {
      try {
        setLoading(true);
        setError(null);
        await friendService.removeFriend(friendId);
        await loadFriends();
        return true;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to remove friend");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [loadFriends]
  );

  const searchUsers = useCallback(
    async (query: string): Promise<UserSearchResult[]> => {
      try {
        setLoading(true);
        setError(null);
        const results = await friendService.searchUsers(query);
        return results;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to search users");
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getFriendSuggestions = useCallback(async (): Promise<
    FriendSuggestion[]
  > => {
    try {
      setLoading(true);
      setError(null);
      const suggestions = await friendService.getFriendSuggestions(10);
      return suggestions;
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to get suggestions");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const blockUser = useCallback(
    async (userId: string) => {
      try {
        setLoading(true);
        setError(null);
        await friendService.blockUser(userId);
        await loadFriends();
        return true;
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to block user");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [loadFriends]
  );

  // Listen for real-time friend request events
  useEffect(() => {
    const handleFriendRequest = () => {
      loadPendingRequests();
    };

    socketService.on("friend:request:receive", handleFriendRequest);
    socketService.on("friend:request:accepted", loadFriends);

    return () => {
      socketService.off("friend:request:receive", handleFriendRequest);
      socketService.off("friend:request:accepted", loadFriends);
    };
  }, [loadPendingRequests, loadFriends]);

  return {
    friends,
    pendingRequests,
    sentRequests,
    loading,
    error,
    loadFriends,
    loadPendingRequests,
    loadSentRequests,
    sendFriendRequest,
    acceptRequest,
    declineRequest,
    cancelSentRequest,
    removeFriend,
    searchUsers,
    getFriendSuggestions,
    blockUser,
  };
};
