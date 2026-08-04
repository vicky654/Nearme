import { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</p>
      {description && <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
