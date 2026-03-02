export default function LearnerLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-72 rounded-lg bg-gray-200 dark:bg-gray-800" />
          <div className="h-4 w-96 rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="h-10 w-36 rounded-xl bg-gray-200 dark:bg-gray-800" />
      </div>

      {/* KPI grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="h-[108px] rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3"
          >
            <div className="h-3 w-28 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-8 w-20 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        ))}
      </div>

      {/* Main + rail skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-[2.1fr_1fr] gap-6">
        <div className="space-y-4">
          <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-[220px] rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-48 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800" />
          <div className="h-64 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800" />
        </div>
      </div>
    </div>
  );
}
