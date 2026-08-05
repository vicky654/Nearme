import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Skeleton } from '../../components/ui/Skeleton';
import { verifyEmail } from '../../api/authApi';
import { toast } from '../../store/toastStore';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const query = useQuery({
    queryKey: ['verify-email', token],
    queryFn: ({ signal }) => verifyEmail(token, signal),
    enabled: Boolean(token),
    retry: false,
  });

  useEffect(() => {
    if (query.isSuccess) {
      toast.success('Email verified successfully!');
    }
  }, [query.isSuccess]);

  if (!token) {
    return <p className="text-sm text-red-600">This verification link is missing a token.</p>;
  }

  if (query.isPending) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (query.isError) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Verification failed</h1>
        <p className="text-sm text-red-600">This link is invalid or has expired.</p>
        <Link to="/login" className="text-indigo-600 hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Email verified</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Your email address has been confirmed. You can now log in.
      </p>
      <Link to="/login" className="text-indigo-600 hover:underline">
        Go to login
      </Link>
    </div>
  );
}
