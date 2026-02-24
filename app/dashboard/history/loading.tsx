export default function HistoryLoading() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg border bg-muted/30" />
        ))}
      </div>
    </div>
  );
}
