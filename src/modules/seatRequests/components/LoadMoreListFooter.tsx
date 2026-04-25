type LoadMoreListFooterProps = {
  tr: (english: string, mongolian: string) => string;
  visibleCount: number;
  totalCount: number;
  onLoadMore: () => void;
  loading?: boolean;
};

export default function LoadMoreListFooter({
  tr,
  visibleCount,
  totalCount,
  onLoadMore,
  loading = false,
}: LoadMoreListFooterProps) {
  if (totalCount <= 0) {
    return null;
  }

  const safeVisibleCount = Math.max(
    0,
    Math.min(totalCount, Math.floor(Number(visibleCount) || 0)),
  );
  const hasMore = safeVisibleCount < totalCount;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="text-gray-600">
        {tr(
          `Showing ${safeVisibleCount} of ${totalCount}.`,
          `${totalCount}-с ${safeVisibleCount}-г харуулж байна.`,
        )}
      </span>

      <button
        type="button"
        className="mono-button mono-button--ghost"
        onClick={onLoadMore}
        disabled={!hasMore || loading}
      >
        {loading
          ? tr("Loading...", "Ачаалж байна...")
          : hasMore
            ? tr("Load more", "Илүүг харах")
            : tr("All loaded", "Бүгд харагдсан")}
      </button>
    </div>
  );
}
