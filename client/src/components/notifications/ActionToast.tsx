import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../../store/notificationStore';
import { acceptFriendRequest } from '../../api/friendApi';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { toast } from '../../store/toastStore';

export function ActionToast() {
  const navigate = useNavigate();
  const { activeToast, closeToast } = useNotificationStore();

  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        closeToast();
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [activeToast, closeToast]);

  if (!activeToast) return null;

  const { notification } = activeToast;
  const isFriendReq = notification.type === 'friend_request_received';
  const isMessage = notification.type === 'new_message';
  const isAccepted = notification.type === 'friend_request_accepted';

  async function handleAccept() {
    if (notification.relatedId) {
      try {
        await acceptFriendRequest(notification.relatedId);
        toast.success('Friend request accepted!');
        closeToast();
        navigate('/friends');
      } catch {
        toast.error('Failed to accept request');
      }
    }
  }

  function handleOpenChat() {
    closeToast();
    if (notification.relatedId) {
      navigate('/chat', { state: { conversationId: notification.relatedId } });
    } else {
      navigate('/chat');
    }
  }

  function handleViewFriends() {
    closeToast();
    navigate('/friends');
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex max-w-sm w-full flex-col gap-3 rounded-2xl border border-indigo-100 bg-white p-4 shadow-2xl transition-all animate-in slide-in-from-bottom-5 dark:border-indigo-900/50 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar
            src={notification.senderId?.avatarUrl}
            alt={notification.senderId?.displayName || 'Notification'}
            seed={notification.senderId?.username || notification.senderId?.displayName || notification._id}
            size="md"
            shape="squircle"
          />
          <div>
            <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">
              {notification.title}
            </h4>
            <p className="mt-0.5 text-xs text-gray-600 line-clamp-2 dark:text-gray-300">
              {notification.message}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={closeToast}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
        {isFriendReq && (
          <>
            <Button size="sm" onClick={handleAccept}>
              Accept
            </Button>
            <Button size="sm" variant="secondary" onClick={handleViewFriends}>
              View Friends
            </Button>
          </>
        )}

        {isMessage && (
          <>
            <Button size="sm" onClick={handleOpenChat}>
              Open Chat
            </Button>
            <Button size="sm" variant="secondary" onClick={closeToast}>
              Close
            </Button>
          </>
        )}

        {isAccepted && (
          <>
            <Button size="sm" onClick={handleOpenChat}>
              Start Chat
            </Button>
            <Button size="sm" variant="secondary" onClick={closeToast}>
              Dismiss
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
