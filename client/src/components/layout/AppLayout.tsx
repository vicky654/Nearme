import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { VerifyEmailBanner } from '../auth/VerifyEmailBanner';
import { useAuthStore } from '../../store/authStore';
import { logoutUser } from '../../api/authApi';
import { toast } from '../../store/toastStore';

export default function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  async function handleLogout() {
    try {
      await logoutUser();
    } catch {
      // Best-effort: proceed with client-side logout even if the server call fails.
    } finally {
      clearAuth();
      toast.success('Logged out');
      navigate('/login');
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link to="/dashboard">NearMe</Link>
          <Link to="/profile">Profile</Link>
          <Link to="/settings">Settings</Link>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          {user && <span>{user.displayName}</span>}
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </header>
      <VerifyEmailBanner />
      <main className="flex-1">{children}</main>
    </div>
  );
}
