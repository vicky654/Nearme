import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Button } from '../ui/Button';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { resendVerification } from '../../api/authApi';

export function VerifyEmailBanner() {
  const user = useAuthStore((state) => state.user);
  const [dismissed, setDismissed] = useState(false);

  const mutation = useMutation({
    mutationFn: (email: string) => resendVerification(email),
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { error?: string } | undefined)?.error
        : undefined;
      toast.error(message ?? 'Unable to resend the verification email. Please try again.');
    },
  });

  if (!user || user.emailVerifiedAt || dismissed) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-amber-300 bg-amber-50 px-6 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <p>Please verify your email address.</p>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          isLoading={mutation.isPending}
          onClick={() => mutation.mutate(user.email)}
        >
          Resend verification email
        </Button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          className="text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
