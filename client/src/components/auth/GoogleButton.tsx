import { useEffect, useId, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { googleLogin } from '../../api/authApi';
import { toast } from '../../store/toastStore';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: { theme: string; size: string }) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export function GoogleButton() {
  const containerId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setTheme = useThemeStore((state) => state.setTheme);

  const mutation = useMutation({
    mutationFn: googleLogin,
    onSuccess: ({ user, accessToken }) => {
      setAuth(user, accessToken);
      setTheme(user.theme);
      toast.success(`Welcome, ${user.displayName}!`);
      navigate('/dashboard');
    },
    onError: () => toast.error('Google sign-in failed. Please try again.'),
  });

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      return;
    }

    function initialize() {
      if (!window.google || !containerRef.current) {
        return;
      }
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID as string,
        callback: (response) => mutation.mutate(response.credential),
      });
      window.google.accounts.id.renderButton(containerRef.current, { theme: 'outline', size: 'large' });
    }

    if (window.google) {
      initialize();
      return;
    }

    const script = document.getElementById('google-identity-script');
    script?.addEventListener('load', initialize);
    return () => script?.removeEventListener('load', initialize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <button
        type="button"
        disabled
        title="Google login is not configured yet"
        className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-400 dark:border-gray-700"
      >
        Continue with Google
      </button>
    );
  }

  return <div ref={containerRef} id={containerId} />;
}
