import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthLayout from '../components/layout/AuthLayout';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import AdminRoute from '../components/auth/AdminRoute';

const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../pages/auth/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('../pages/auth/VerifyEmailPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const SettingsPage = lazy(() => import('../pages/settings/SettingsPage'));
const NearbyPage = lazy(() => import('../pages/NearbyPage'));
const SearchPage = lazy(() => import('../pages/SearchPage'));
const FriendsPage = lazy(() => import('../pages/FriendsPage'));
const ChatPage = lazy(() => import('../pages/ChatPage'));
const NotificationsPage = lazy(() => import('../pages/NotificationsPage'));
const AdminPage = lazy(() => import('../pages/AdminPage'));

function page(element: React.ReactNode) {
  return <Suspense fallback={<div className="page-shell"><div className="h-32 animate-pulse rounded-[2rem] bg-gray-200 dark:bg-gray-800" /></div>}>{element}</Suspense>;
}

const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: page(<LoginPage />) },
      { path: '/register', element: page(<RegisterPage />) },
      { path: '/forgot-password', element: page(<ForgotPasswordPage />) },
      { path: '/reset-password', element: page(<ResetPasswordPage />) },
      { path: '/verify-email', element: page(<VerifyEmailPage />) },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/dashboard', element: page(<DashboardPage />) },
      { path: '/nearby', element: page(<NearbyPage />) },
      { path: '/search', element: page(<SearchPage />) },
      { path: '/friends', element: page(<FriendsPage />) },
      { path: '/chat', element: page(<ChatPage />) },
      { path: '/notifications', element: page(<NotificationsPage />) },
      { path: '/profile', element: page(<ProfilePage />) },
      { path: '/settings', element: page(<SettingsPage />) },
    ],
  },
  {
    element: <AdminRoute />,
    children: [{ path: '/admin', element: page(<AdminPage />) }],
  },
  { path: '/', element: <Navigate to="/dashboard" replace /> },
]);

export default router;
