import { useCallback, useState } from "react";

export interface PaginationConfig {
  initialPage?: number;
  pageSize?: number;
  onLoadMore?: (page: number) => Promise<void>;
  onRefresh?: () => Promise<void>;
}

export interface PaginationState {
  page: number;
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
}

export interface PaginationActions {
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  setHasMore: (hasMore: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  setPage: (page: number) => void;
}

/**
 * Reusable pagination hook for infinite scroll and pull-to-refresh
 *
 * @example
 * ```tsx
 * const { state, actions } = usePagination({
 *   pageSize: 20,
 *   onLoadMore: async (page) => {
 *     const data = await api.getData({ page, limit: 20 });
 *     actions.setHasMore(data.hasMore);
 *   },
 *   onRefresh: async () => {
 *     const data = await api.getData({ page: 0, limit: 20 });
 *     actions.setHasMore(data.hasMore);
 *   }
 * });
 *
 * <FlatList
 *   data={items}
 *   onEndReached={actions.loadMore}
 *   onEndReachedThreshold={0.5}
 *   refreshControl={
 *     <RefreshControl
 *       refreshing={state.isRefreshing}
 *       onRefresh={actions.refresh}
 *     />
 *   }
 *   ListFooterComponent={
 *     state.isLoadingMore ? <ActivityIndicator /> : null
 *   }
 * />
 * ```
 */
export const usePagination = (config: PaginationConfig = {}) => {
  const { initialPage = 0, pageSize = 20, onLoadMore, onRefresh } = config;

  const [page, setPage] = useState(initialPage);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load next page of data
   */
  const loadMore = useCallback(async () => {
    if (isLoadingMore || isRefreshing || !hasMore) {
      return;
    }

    try {
      setIsLoadingMore(true);
      setError(null);
      const nextPage = page + 1;

      if (onLoadMore) {
        await onLoadMore(nextPage);
      }

      setPage(nextPage);
    } catch (err: any) {
      setError(err.message || "Failed to load more");
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, isRefreshing, hasMore, page, onLoadMore]);

  /**
   * Refresh data from the beginning
   */
  const refresh = useCallback(async () => {
    if (isRefreshing || isLoadingMore) {
      return;
    }

    try {
      setIsRefreshing(true);
      setError(null);
      setPage(initialPage);
      setHasMore(true);

      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: any) {
      setError(err.message || "Failed to refresh");
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, isLoadingMore, initialPage, onRefresh]);

  /**
   * Reset pagination state
   */
  const reset = useCallback(() => {
    setPage(initialPage);
    setIsLoading(false);
    setIsRefreshing(false);
    setIsLoadingMore(false);
    setHasMore(true);
    setError(null);
  }, [initialPage]);

  const state: PaginationState = {
    page,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    error,
  };

  const actions: PaginationActions = {
    loadMore,
    refresh,
    setHasMore,
    setError,
    reset,
    setPage,
  };

  return { state, actions, pageSize };
};
