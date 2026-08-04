import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { toast } from '../../store/toastStore';
import { resetPassword } from '../../api/authApi';
import { resetPasswordSchema, ResetPasswordFormValues } from '../../validators/authSchemas';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) });

  const mutation = useMutation({
    mutationFn: (values: ResetPasswordFormValues) => resetPassword({ token, password: values.password }),
    onSuccess: () => {
      toast.success('Password reset. Please log in.');
      navigate('/login');
    },
    onError: () => {
      toast.error('That reset link is invalid or has expired.');
    },
  });

  if (!token) {
    return <p className="text-sm text-red-600">This reset link is missing a token.</p>;
  }

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <Input
        label="New password"
        type="password"
        error={errors.password?.message}
        {...register('password')}
      />
      <Input
        label="Confirm password"
        type="password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
      <Button type="submit" isLoading={mutation.isPending}>
        Reset password
      </Button>
      <Link to="/login" className="text-sm text-indigo-600 hover:underline">
        Back to login
      </Link>
    </form>
  );
}
