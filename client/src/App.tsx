import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import router from './routes/router';
import { Toaster } from './components/ui/Toaster';
import { Skeleton } from './components/ui/Skeleton';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { useAuthBootstrap } from './hooks/useAuthBootstrap';
import { getFriendlyApiError } from './api/errors';
import { toast } from './store/toastStore';
import { useThemeStore } from './store/themeStore';

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (!mutation.options.onError) toast.error(getFriendlyApiError(error).message);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      networkMode: 'offlineFirst',
      retry: (failureCount, error) => {
        const friendly = getFriendlyApiError(error);
        return friendly.retryable && failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
    },
    mutations: { networkMode: 'online', retry: false },
  },
});

function AppContent() {
  const isBootstrapping = useAuthBootstrap();
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    void StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
    const effectiveDark = document.documentElement.getAttribute('data-theme') === 'dark';
    void StatusBar.setStyle({ style: effectiveDark ? Style.Light : Style.Dark }).catch(() => undefined);
    void StatusBar.setBackgroundColor({ color: effectiveDark ? '#0e1019' : '#ffffff' }).catch(() => undefined);
  }, [theme]);

  useEffect(() => {
    if (!isBootstrapping) void SplashScreen.hide().catch(() => undefined);
  }, [isBootstrapping]);

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#f7f8fc] dark:bg-gray-950" role="status" aria-label="Restoring your session">
        <div className="grid h-16 w-16 animate-pulse place-items-center rounded-[22px] bg-gradient-to-br from-brand-500 to-violet-600 text-2xl font-black text-white shadow-xl shadow-brand-500/25">N</div>
        <div className="space-y-2 text-center"><Skeleton className="mx-auto h-4 w-32" /><p className="text-xs font-medium text-gray-400">Restoring your NearMe session…</p></div>
      </div>
    );
  }

  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
