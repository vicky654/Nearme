import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { toast } from '../../store/toastStore';
import { forgotPassword } from '../../api/authApi';
import { forgotPasswordSchema, ForgotPasswordFormValues } from '../../validators/authSchemas';

export default function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  const mutation = useMutation({
    mutationFn: (values: ForgotPasswordFormValues) => forgotPassword(values.email),
    onError: () => {
      toast.error('Something went wrong. Please try again.');
    },
  });

  if (mutation.isSuccess) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">{mutation.data.message}</p>
        <Link to="/login" className="text-indigo-600 hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      <h1 className="text-xl font-semibold">Reset your password</h1>
      <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
      <Button type="submit" isLoading={mutation.isPending}>
        Send reset link
      </Button>
      <Link to="/login" className="text-sm text-indigo-600 hover:underline">
        Back to login
      </Link>
    </form>
  );
}
