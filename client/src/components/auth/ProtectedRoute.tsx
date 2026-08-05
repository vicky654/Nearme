import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import AppLayout from '../layout/AppLayout';
import { disconnectSocket } from '../../api/socket';
import { useChatStore } from '../../store/chatStore';
import { useNotificationStore } from '../../store/notificationStore';
import { cancelPendingApiRequests } from '../../api/axiosClient';

export default function ProtectedRoute() {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  useEffect(() => {
    if (user) return;
    cancelPendingApiRequests();
    disconnectSocket();
    useChatStore.getState().reset();
    useNotificationStore.getState().reset();
  }, [user]);

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
