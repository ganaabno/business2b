import { useEffect, useMemo, useState } from "react";

type UseLoadMorePaginationOptions = {
  initialCount?: number;
  step?: number;
};

function toPositiveInteger(value: number | undefined, fallback: number) {
  const normalized = Math.floor(Number(value) || 0);
  return normalized > 0 ? normalized : fallback;
}

export function useLoadMorePagination<T>(
  items: T[],
  options: UseLoadMorePaginationOptions = {},
) {
  const initialCount = toPositiveInteger(options.initialCount, 10);
  const step = toPositiveInteger(options.step, initialCount);
  const [visibleCount, setVisibleCount] = useState(initialCount);

  useEffect(() => {
    setVisibleCount(initialCount);
  }, [items, initialCount]);

  const totalCount = items.length;
  const safeVisibleCount = Math.min(visibleCount, totalCount);

  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount],
  );

  const hasMore = safeVisibleCount < totalCount;
  const remainingCount = Math.max(0, totalCount - safeVisibleCount);

  const loadMore = () => {
    setVisibleCount((previous) => Math.min(previous + step, totalCount));
  };

  const reset = () => {
    setVisibleCount(initialCount);
  };

  return {
    visibleItems,
    visibleCount: safeVisibleCount,
    totalCount,
    hasMore,
    remainingCount,
    loadMore,
    reset,
  };
}
