export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-md bg-gray-200 dark:bg-gray-800 ${className}`} />;
}
