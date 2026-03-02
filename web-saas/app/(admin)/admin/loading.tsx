export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-8 w-56 rounded-lg bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 rounded-xl bg-gray-200 dark:bg-gray-800" />
          <div className="h-10 w-28 rounded-xl bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="h-28 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3"
          >
            <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-7 w-16 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-800">
          <div className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="divide-y divide-slate-100 dark:divide-gray-800">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="px-5 py-4 flex items-center gap-4">
              <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-800 flex-1" />
              <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-6 w-16 rounded-full bg-gray-200 dark:bg-gray-800" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
