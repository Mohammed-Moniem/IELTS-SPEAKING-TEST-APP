import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-6">
      <div className="text-center space-y-6 max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-violet-50 dark:bg-violet-500/10 mx-auto">
          <span className="material-symbols-outlined text-[40px] text-violet-600 dark:text-violet-400">explore_off</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">404</h1>
          <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Page Not Found</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/app/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">dashboard</span>
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Home Page
          </Link>
        </div>
      </div>
    </div>
  );
}
