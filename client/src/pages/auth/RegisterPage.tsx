import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { GoogleButton } from '../../components/auth/GoogleButton';
import { toast } from '../../store/toastStore';
import { registerUser } from '../../api/authApi';
import { registerSchema, RegisterFormValues } from '../../validators/authSchemas';

export default function RegisterPage() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const mutation = useMutation({
    mutationFn: registerUser,
    onSuccess: () => {
      toast.success('Check your email to verify your account.');
      navigate('/login');
    },
    onError: (error) => {
      const message = isAxiosError(error)
        ? (error.response?.data as { error?: string } | undefined)?.error
        : undefined;
      toast.error(message ?? 'Unable to register. Please try again.');
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      <h1 className="text-xl font-semibold">Create your NearMe account</h1>
      <Input label="Username" error={errors.username?.message} {...register('username')} />
      <Input label="Display name" error={errors.displayName?.message} {...register('displayName')} />
      <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
      <Input label="Password" type="password" error={errors.password?.message} {...register('password')} />
      <Button type="submit" isLoading={mutation.isPending}>
        Create account
      </Button>
      <p className="text-sm">
        Already have an account?{' '}
        <Link to="/login" className="text-indigo-600 hover:underline">
          Log in
        </Link>
      </p>
      <div className="my-2 text-center text-xs uppercase text-gray-400">or</div>
      <GoogleButton />
    </form>
  );
}
