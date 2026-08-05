import { ReactNode } from 'react';
import { motion } from 'framer-motion';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="app-card flex flex-col items-center gap-2 border-dashed p-10 text-center">
      <motion.div animate={{ y: [0, -5, 0], rotate: [0, 2, 0] }} transition={{ repeat: Infinity, duration: 3.4 }} className="mb-2 grid h-16 w-16 place-items-center rounded-[1.35rem] bg-gradient-to-br from-brand-500 to-violet-600 text-2xl text-white shadow-lg shadow-brand-500/25">✦</motion.div>
      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</p>
      {description && <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}
