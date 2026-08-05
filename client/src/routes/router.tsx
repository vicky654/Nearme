import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthLayout from '../components/layout/AuthLayout';
import { Skeleton } from '../components/ui/Skeleton';

const ProtectedRoute = lazy(() => import('../components/auth/ProtectedRoute'));
const AdminRoute = lazy(() => import('../components/auth/AdminRoute'));
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

function RouteSkeleton() {
  return (
    <div className="page-shell space-y-5" role="status" aria-label="Loading page">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <div className="flex-1 space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-3 w-64 max-w-full" /></div>
      </div>
      <Skeleton className="h-36 w-full rounded-[2rem]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-28 rounded-[1.5rem]" />)}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

function page(element: React.ReactNode) {
  return <Suspense fallback={<RouteSkeleton />}>{element}</Suspense>;
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
    element: page(<ProtectedRoute />),
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
    element: page(<AdminRoute />),
    children: [{ path: '/admin', element: page(<AdminPage />) }],
  },
  { path: '/', element: <Navigate to="/dashboard" replace /> },
]);

export default router;
