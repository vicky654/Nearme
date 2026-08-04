import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { toast } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';
import { getMe, updateMe } from '../api/userApi';
import { profileFormSchema, ProfileFormValues } from '../validators/userSchemas';
import type { User } from '../types/user';

function toFormValues(user: User): ProfileFormValues {
  return {
    displayName: user.displayName,
    bio: user.bio ?? '',
    gender: (user.gender as ProfileFormValues['gender']) ?? '',
    age: user.age ? String(user.age) : '',
    country: user.country ?? '',
    city: user.city ?? '',
    interests: user.interests.join(', '),
    languages: user.languages.join(', '),
  };
}

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((state) => state.setAuth);
  const accessToken = useAuthStore((state) => state.accessToken);

  const query = useQuery({ queryKey: ['me'], queryFn: getMe, retry: false });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    values: query.data ? toFormValues(query.data.user) : undefined,
  });

  const mutation = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      updateMe({
        displayName: values.displayName,
        bio: values.bio || undefined,
        gender: values.gender || undefined,
        age: values.age ? Number(values.age) : undefined,
        country: values.country || undefined,
        city: values.city || undefined,
        interests: values.interests
          ? values.interests.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        languages: values.languages
          ? values.languages.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
      }),
    onSuccess: ({ user }) => {
      if (accessToken) {
        setAuth(user, accessToken);
      }
      queryClient.setQueryData(['me'], { user });
      reset(toFormValues(user));
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    },
    onError: () => toast.error('Unable to update profile. Please try again.'),
  });

  if (query.isPending) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
        <Skeleton className="h-48 w-full rounded-3xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <EmptyState
        title="Couldn't load your profile"
        description="Something went wrong fetching your profile. Please refresh the page."
      />
    );
  }

  const user = query.data.user;

  function handleShareProfile() {
    if (navigator.share) {
      navigator.share({ title: user.displayName, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Profile link copied to clipboard!');
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6 animate-in fade-in duration-300">
      {/* Cover Banner & Profile Card */}
      <div className="relative rounded-3xl bg-white shadow-sm border border-gray-200 overflow-hidden dark:border-gray-800 dark:bg-gray-900">
        {/* Cover Photo */}
        <div className="h-48 w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 relative">
          <div className="absolute inset-0 bg-black/10" />
        </div>

        {/* Profile Info Row */}
        <div className="relative px-6 pb-6 pt-0">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-16 sm:-mt-14 mb-4">
            <div className="relative inline-block">
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="h-28 w-28 rounded-full border-4 border-white object-cover shadow-md dark:border-gray-900"
              />
              <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white bg-green-500 dark:border-gray-900" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setIsEditing(true)}>
                ✏️ Edit Profile
              </Button>
              <Button size="sm" variant="secondary" onClick={handleShareProfile}>
                🔗 Share Profile
              </Button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {user.displayName}
              </h1>
              <span className="text-indigo-600 text-lg" title="Verified User">
                ☑️
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</p>

            <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-300">
              {user.age && <span>🎂 {user.age} years old</span>}
              {user.city && user.country && <span>📍 {user.city}, {user.country}</span>}
              {user.gender && <span className="capitalize">👤 {user.gender}</span>}
              <span>📅 Joined {new Date(user.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Left Column: Bio & Info */}
        <div className="flex flex-col gap-6 md:col-span-2">
          {/* Bio Card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">About Me</h3>
            <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
              {user.bio || 'No bio added yet. Click Edit Profile to tell others about yourself!'}
            </p>
          </div>

          {/* Interests */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Interests</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {user.interests.length === 0 ? (
                <span className="text-xs text-gray-400">No interests listed</span>
              ) : (
                user.interests.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-xl bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300"
                  >
                    ✨ {tag}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Languages */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Languages</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {user.languages.length === 0 ? (
                <span className="text-xs text-gray-400">No languages listed</span>
              ) : (
                user.languages.map((lang) => (
                  <span
                    key={lang}
                    className="rounded-xl bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-600 dark:bg-purple-950/60 dark:text-purple-300"
                  >
                    🗣️ {lang}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Quick Stats & Connections */}
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Account Overview</h3>
            <div className="mt-4 flex flex-col gap-3 text-xs">
              <div className="flex justify-between border-b border-gray-100 pb-2 dark:border-gray-800">
                <span className="text-gray-500">Account Status</span>
                <span className="font-bold text-green-600 capitalize">{user.status}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2 dark:border-gray-800">
                <span className="text-gray-500">Account Role</span>
                <span className="font-bold text-indigo-600 capitalize">{user.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Email Verified</span>
                <span className="font-bold text-indigo-600">
                  {user.emailVerifiedAt ? '✓ Yes' : '❌ Pending'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Edit Profile</h2>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form
              className="mt-4 flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1"
              noValidate
              onSubmit={handleSubmit((values) => mutation.mutate(values))}
            >
              <Input label="Display name" error={errors.displayName?.message} {...register('displayName')} />
              <Input label="Bio" error={errors.bio?.message} {...register('bio')} />
              <div className="flex flex-col gap-1">
                <label htmlFor="gender" className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Gender
                </label>
                <select
                  id="gender"
                  {...register('gender')}
                  className="rounded-xl border border-gray-300 p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non-binary">Non-binary</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
              </div>
              <Input label="Age" type="number" error={errors.age?.message} {...register('age')} />
              <Input label="Country" error={errors.country?.message} {...register('country')} />
              <Input label="City" error={errors.city?.message} {...register('city')} />
              <Input label="Interests (comma-separated)" error={errors.interests?.message} {...register('interests')} />
              <Input label="Languages (comma-separated)" error={errors.languages?.message} {...register('languages')} />

              <div className="mt-4 flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" isLoading={mutation.isPending}>
                  Save changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
