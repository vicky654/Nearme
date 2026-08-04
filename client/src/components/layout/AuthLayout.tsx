import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white/80 p-8 shadow-xl backdrop-blur dark:border-gray-800 dark:bg-gray-900/80">
        <Outlet />
      </div>
    </div>
  );
}
