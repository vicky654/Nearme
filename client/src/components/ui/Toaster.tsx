import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore } from '../../store/toastStore';

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[max(5.5rem,calc(var(--sab)+1rem))] z-[70] mx-auto flex max-w-sm flex-col gap-2 md:inset-x-auto md:bottom-5 md:right-5 md:mx-0">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            role={t.type === 'error' ? 'alert' : 'status'}
            aria-live={t.type === 'error' ? 'assertive' : 'polite'}
            className={`pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur ${
              t.type === 'success' ? 'bg-emerald-600/95 text-white' : 'bg-gray-950/95 text-white dark:bg-red-600/95'
            }`}
          >
            <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/15">{t.type === 'success' ? '✓' : '!'}</span>
            <span className="flex-1">{t.message}</span>
            <button type="button" aria-label="Dismiss notification" onClick={() => useToastStore.getState().removeToast(t.id)} className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">×</button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
