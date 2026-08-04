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
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <div role="tablist" className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-sm font-medium ${
              activeTab === tab.key
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'profile' && <ProfileTab />}
      {activeTab === 'password' && <PasswordTab />}
      {activeTab === 'privacy' && <PrivacyTab />}
      {activeTab === 'theme' && <ThemeTab />}
      {activeTab === 'notifications' && <NotificationsTab />}
    </div>
  );
}

function ProfileTab() {
  return (
    <div className="flex flex-col gap-2">
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
      className="flex max-w-sm flex-col gap-4"
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
  const query = useQuery({ queryKey: ['settings'], queryFn: getSettings });

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
    <div className="flex flex-col gap-3">
      {PRIVACY_LABELS.map(({ key, label }) => (
        <label key={key} className="flex items-center justify-between gap-4 text-sm">
          {label}
          <input
            type="checkbox"
            checked={query.data!.privacy[key]}
            onChange={(e) => mutation.mutate({ [key]: e.target.checked })}
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
    <div className="flex gap-3">
      {THEME_OPTIONS.map((option) => (
        <button
          key={option}
          onClick={() => handleSelect(option)}
          aria-pressed={theme === option}
          className={`rounded-xl border px-4 py-2 text-sm capitalize ${
            theme === option
              ? 'border-indigo-600 bg-indigo-50 text-indigo-600 dark:bg-indigo-950'
              : 'border-gray-300 dark:border-gray-700'
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
        <input type="checkbox" checked={soundEnabled} onChange={toggleSound} />
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
