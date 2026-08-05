import { AnimatePresence, motion } from 'framer-motion';

export function NetworkBanner({ isOnline }: { isOnline: boolean }) {
  return <AnimatePresence>{!isOnline && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} role="status" aria-live="polite" className="z-50 overflow-hidden bg-amber-500 px-4 py-2 text-center text-xs font-bold text-amber-950">You’re offline. Showing saved content until your connection returns.</motion.div>}</AnimatePresence>;
}
