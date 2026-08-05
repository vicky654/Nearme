import { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="app-card flex flex-col items-center gap-2 border-dashed p-10 text-center">
      <div className="mb-2 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-2xl text-brand-600 dark:bg-brand-500/10">✦</div>
      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</p>
      {description && <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
