import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#f7f8fc] px-4 py-8 dark:bg-gray-950 sm:items-center sm:justify-center">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 h-96 w-96 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="relative mx-auto flex w-full max-w-md flex-col justify-center">
        <div className="mb-7 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-[20px] bg-gradient-to-br from-brand-500 to-violet-600 text-2xl font-black text-white shadow-xl shadow-brand-500/25">N</div>
          <p className="mt-3 text-2xl font-black tracking-[-.04em] text-ink dark:text-white">near<span className="text-brand-600">me</span></p>
          <p className="mt-1 text-xs font-medium text-gray-400">Good people are closer than you think.</p>
        </div>
        <div className="rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-[0_24px_70px_-24px_rgba(35,43,80,.24)] backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/85 sm:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
