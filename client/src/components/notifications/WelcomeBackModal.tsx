import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../../store/notificationStore';
import { Button } from '../ui/Button';

export function WelcomeBackModal() {
  const navigate = useNavigate();
  const { showWelcomeBackModal, welcomeBackCounts, closeWelcomeBackModal } = useNotificationStore();

  if (!showWelcomeBackModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl transition-all dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
        <div className="text-center">
          <span className="text-4xl">👋</span>
          <h3 className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">Welcome Back!</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Here is a summary of what you missed while away:
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2 rounded-2xl bg-indigo-50/60 p-4 dark:bg-indigo-950/40">
          {welcomeBackCounts.messages > 0 && (
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-900 dark:text-indigo-200">
              <span>💬 New Messages</span>
              <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-white">
                {welcomeBackCounts.messages}
              </span>
            </div>
          )}
          {welcomeBackCounts.requests > 0 && (
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-900 dark:text-indigo-200">
              <span>👤 Friend Requests</span>
              <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-white">
                {welcomeBackCounts.requests}
              </span>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {welcomeBackCounts.messages > 0 && (
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                closeWelcomeBackModal();
                navigate('/chat');
              }}
            >
              View Messages
            </Button>
          )}

          {welcomeBackCounts.requests > 0 && (
            <Button
              size="sm"
              variant={welcomeBackCounts.messages > 0 ? 'secondary' : 'primary'}
              className="w-full"
              onClick={() => {
                closeWelcomeBackModal();
                navigate('/friends');
              }}
            >
              View Requests
            </Button>
          )}

          <Button size="sm" variant="ghost" className="w-full" onClick={closeWelcomeBackModal}>
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}
