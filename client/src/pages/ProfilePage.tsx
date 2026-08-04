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
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((state) => state.setAuth);
  const accessToken = useAuthStore((state) => state.accessToken);

  const query = useQuery({ queryKey: ['me'], queryFn: getMe, retry: false });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
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
      toast.success('Profile updated');
    },
    onError: () => toast.error('Unable to update profile. Please try again.'),
  });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <EmptyState
        title="Couldn't load your profile"
        description="Something went wrong fetching your profile. Please try refreshing the page."
      />
    );
  }

  return (
    <form
      className="flex max-w-lg flex-col gap-4 p-6"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      <h1 className="text-xl font-semibold">Your profile</h1>
      <Input label="Display name" error={errors.displayName?.message} {...register('displayName')} />
      <Input label="Bio" error={errors.bio?.message} {...register('bio')} />
      <div className="flex flex-col gap-1">
        <label htmlFor="gender" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Gender
        </label>
        <select
          id="gender"
          {...register('gender')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
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
      <Button type="submit" isLoading={mutation.isPending} disabled={!isDirty}>
        Save changes
      </Button>
    </form>
  );
}
