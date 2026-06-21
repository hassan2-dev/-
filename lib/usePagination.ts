import { useCallback, useEffect, useMemo, useState } from 'react';

export function usePagination<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [items, pageSize]);

  const visibleItems = useMemo(
    () => items.slice(0, page * pageSize),
    [items, page, pageSize]
  );

  const hasMore = visibleItems.length < items.length;

  const loadMore = useCallback(() => {
    if (hasMore) setPage((p) => p + 1);
  }, [hasMore]);

  const reset = useCallback(() => setPage(1), []);

  return {
    visibleItems,
    hasMore,
    loadMore,
    reset,
    total: items.length,
    shown: visibleItems.length,
  };
}
