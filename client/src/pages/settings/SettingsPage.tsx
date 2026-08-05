import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { toast } from '../../store/toastStore';
import { useThemeStore, ThemePreference } from '../../store/themeStore';
import { getSettings, updateSettings, changePassword, SettingsPayload } from '../../api/userApi';
import { changePasswordFormSchema, ChangePasswordFormValues } from '../../validators/userSchemas';
import type { PrivacySettings } from '../../types/user';

import { useNotificationStore } from '../../store/notificationStore';
import { requestBrowserNotificationPermission } from '../../utils/browserNotificationService';

type SettingsTab = 'profile' | 'password' | 'privacy' | 'theme' | 'notifications';

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'password', label: 'Password' },
  { key: 'privacy', label: 'Privacy' },
  { key: 'theme', label: 'Theme' },
  { key: 'notifications', label: 'Notifications' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  return (
    <div className="page-shell max-w-3xl">
      <div className="mb-5"><p className="eyebrow">Make it yours</p><h1 className="mt-1 text-2xl font-black tracking-tight">Settings</h1><p className="mt-1 text-xs text-gray-400">Account, privacy and app preferences</p></div>
      <div role="tablist" className="scrollbar-none mb-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`min-h-10 shrink-0 rounded-2xl px-4 py-2 text-xs font-bold transition ${
              activeTab === tab.key
                ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                : 'border border-gray-200 bg-white text-gray-500 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="app-card p-5 sm:p-7">
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'password' && <PasswordTab />}
        {activeTab === 'privacy' && <PrivacyTab />}
        {activeTab === 'theme' && <ThemeTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
      </div>
    </div>
  );
}

function ProfileTab() {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-2xl dark:bg-brand-500/10">👤</div>
      <h2 className="text-lg font-black">Your public profile</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Edit your display name, bio, interests, and other profile details from your profile page.
      </p>
      <Link to="/profile" className="w-fit text-sm text-indigo-600 hover:underline">
        Go to your profile →
      </Link>
    </div>
  );
}

function PasswordTab() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({ resolver: zodResolver(changePasswordFormSchema) });

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordFormValues) =>
      changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
    onSuccess: () => {
      toast.success('Password updated');
      reset();
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { error?: string } | undefined)?.error
        : undefined;
      toast.error(message ?? 'Current password is incorrect');
    },
  });

  return (
    <form
      className="flex max-w-md flex-col gap-4"
      noValidate
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      <Input
        label="Current password"
        type="password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />
      <Input
        label="New password"
        type="password"
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />
      <Input
        label="Confirm new password"
        type="password"
        error={errors.confirmNewPassword?.message}
        {...register('confirmNewPassword')}
      />
      <Button type="submit" isLoading={mutation.isPending}>
        Update password
      </Button>
    </form>
  );
}

const PRIVACY_LABELS: { key: keyof PrivacySettings; label: string }[] = [
  { key: 'hideOnlineStatus', label: 'Hide my online status' },
  { key: 'hideDistance', label: 'Hide my distance from other users' },
  { key: 'hideProfile', label: 'Hide my profile from discovery' },
  { key: 'invisibleMode', label: 'Invisible mode' },
  { key: 'privateAccount', label: 'Private account' },
];

function PrivacyTab() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['settings'], queryFn: ({ signal }) => getSettings(signal) });

  const mutation = useMutation({
    mutationFn: (privacy: Partial<PrivacySettings>) => updateSettings({ privacy }),
    onMutate: async (newPrivacyPartial) => {
      await queryClient.cancelQueries({ queryKey: ['settings'] });
      const previousSettings = queryClient.getQueryData<SettingsPayload>(['settings']);
      queryClient.setQueryData<SettingsPayload>(['settings'], (old) =>
        old ? { ...old, privacy: { ...old.privacy, ...newPrivacyPartial } } : old
      );
      return { previousSettings };
    },
    onError: (_err, _newPrivacyPartial, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(['settings'], context.previousSettings);
      }
      toast.error('Unable to update privacy settings');
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      toast.success('Privacy settings updated');
    },
  });

  if (query.isPending) {
    return <Skeleton className="h-40 w-full" />;
  }
  if (query.isError || !query.data) {
    return <p className="text-sm text-red-600">Unable to load privacy settings.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {PRIVACY_LABELS.map(({ key, label }) => (
        <label key={key} className="flex min-h-[58px] items-center justify-between gap-4 rounded-2xl px-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50">
          <span className="font-semibold">{label}</span>
          <input
            type="checkbox"
            checked={query.data!.privacy[key]}
            onChange={(e) => mutation.mutate({ [key]: e.target.checked })}
            className="h-5 w-5 accent-brand-600"
          />
        </label>
      ))}
    </div>
  );
}

const THEME_OPTIONS: ThemePreference[] = ['light', 'dark', 'system'];

function ThemeTab() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  const mutation = useMutation({
    mutationFn: (nextTheme: ThemePreference) => updateSettings({ theme: nextTheme }),
    onError: () => toast.error('Unable to save your theme preference'),
  });

  function handleSelect(nextTheme: ThemePreference) {
    setTheme(nextTheme);
    mutation.mutate(nextTheme);
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {THEME_OPTIONS.map((option) => (
        <button
          key={option}
          onClick={() => handleSelect(option)}
          aria-pressed={theme === option}
          className={`min-h-24 rounded-2xl border p-3 text-sm font-bold capitalize transition ${
            theme === option
              ? 'border-brand-600 bg-brand-50 text-brand-600 ring-2 ring-brand-500/10 dark:bg-brand-500/10'
              : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function NotificationsTab() {
  const soundEnabled = useNotificationStore((state) => state.soundEnabled);
  const toggleSound = useNotificationStore((state) => state.toggleSound);

  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );

  async function handleEnableBrowserNotifs() {
    const res = await requestBrowserNotificationPermission();
    setPermission(res);
    if (res === 'granted') {
      toast.success('Desktop browser notifications enabled!');
    } else {
      toast.error('Browser notification permission was denied.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center justify-between gap-4 text-sm">
        <div>
          <span className="font-semibold text-gray-900 dark:text-gray-100">Play Notification Sounds</span>
          <p className="text-xs text-gray-500">Play a pleasant sound for incoming messages and friend requests</p>
        </div>
        <input className="h-5 w-5 accent-brand-600" type="checkbox" checked={soundEnabled} onChange={toggleSound} />
      </label>

      <div className="flex items-center justify-between gap-4 border-t border-gray-100 pt-4 dark:border-gray-800 text-sm">
        <div>
          <span className="font-semibold text-gray-900 dark:text-gray-100">Desktop Browser Notifications</span>
          <p className="text-xs text-gray-500">
            Status: <span className="font-bold capitalize">{permission}</span>
          </p>
        </div>
        {permission !== 'granted' && (
          <Button size="sm" variant="secondary" onClick={handleEnableBrowserNotifs}>
            Enable Desktop Alerts
          </Button>
        )}
      </div>
    </div>
  );
}
