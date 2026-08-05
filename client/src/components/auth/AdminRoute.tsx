import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import AppLayout from '../layout/AppLayout';
import { disconnectSocket } from '../../api/socket';
import { useChatStore } from '../../store/chatStore';
import { useNotificationStore } from '../../store/notificationStore';
import { cancelPendingApiRequests } from '../../api/axiosClient';

export default function AdminRoute() {
  const { user, accessToken } = useAuthStore();

  useEffect(() => {
    if (user && accessToken) return;
    cancelPendingApiRequests();
    disconnectSocket();
    useChatStore.getState().reset();
    useNotificationStore.getState().reset();
  }, [accessToken, user]);

  if (!accessToken || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
