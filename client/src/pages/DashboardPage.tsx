import { useAuthStore } from '../store/authStore';
import { EmptyState } from '../components/ui/EmptyState';

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="rounded-2xl border border-gray-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
        <h1 className="text-xl font-semibold">Welcome back, {user?.displayName ?? 'there'}!</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Here's your NearMe dashboard.</p>
      </div>
      <EmptyState
        title="More is on the way"
        description="Friends, nearby discovery, chat, and voice calls are coming in upcoming updates."
      />
    </div>
  );
}
