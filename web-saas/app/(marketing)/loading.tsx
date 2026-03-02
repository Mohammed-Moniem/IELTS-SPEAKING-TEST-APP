export default function MarketingLoading() {
  return (
    <div className="mx-auto max-w-4xl w-full space-y-8 animate-pulse py-12">
      {/* Hero skeleton */}
      <div className="text-center space-y-4">
        <div className="h-4 w-24 mx-auto rounded-full bg-gray-200 dark:bg-gray-800" />
        <div className="h-10 w-[480px] max-w-full mx-auto rounded-lg bg-gray-200 dark:bg-gray-800" />
        <div className="h-4 w-[360px] max-w-full mx-auto rounded bg-gray-200 dark:bg-gray-800" />
        <div className="flex items-center justify-center gap-3 pt-4">
          <div className="h-11 w-32 rounded-xl bg-gray-200 dark:bg-gray-800" />
          <div className="h-11 w-32 rounded-xl bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>

      {/* Feature grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="h-48 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
          />
        ))}
      </div>
    </div>
  );
}
