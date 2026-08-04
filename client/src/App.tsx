import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import router from './routes/router';
import { Toaster } from './components/ui/Toaster';
import { Skeleton } from './components/ui/Skeleton';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { useAuthBootstrap } from './hooks/useAuthBootstrap';
import './store/themeStore'; // module import applies the persisted theme before first paint

const queryClient = new QueryClient();

function AppContent() {
  const isBootstrapping = useAuthBootstrap();

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-32" />
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
