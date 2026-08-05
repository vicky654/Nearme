import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { GoogleButton } from '../../components/auth/GoogleButton';
import { toast } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { loginUser } from '../../api/authApi';
import { getFriendlyApiError } from '../../api/errors';
import { loginSchema, LoginFormValues } from '../../validators/authSchemas';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const setAuth = useAuthStore((state) => state.setAuth);
  const setTheme = useThemeStore((state) => state.setTheme);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: localStorage.getItem('nearme.remember-me') === 'true' },
    shouldFocusError: true,
  });

  const mutation = useMutation({
    mutationFn: loginUser,
    onSuccess: ({ user: signedInUser, accessToken }, variables) => {
      setAuth(signedInUser, accessToken);
      setTheme(signedInUser.theme);
      localStorage.setItem('nearme.remember-me', String(Boolean(variables.rememberMe)));
      toast.success(`Welcome back, ${signedInUser.displayName}!`);
      const intendedPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(intendedPath || (signedInUser.role === 'admin' ? '/admin' : '/dashboard'), { replace: true });
    },
    onError: (error) => {
      toast.error(getFriendlyApiError(error, 'Unable to log in. Please try again.').message);
    },
  });

  useEffect(() => {
    if ((location.state as { reason?: string } | null)?.reason === 'session-expired') {
      toast.error('Your session expired. Please sign in again.');
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={handleSubmit(
        (values) => { if (!mutation.isPending) mutation.mutate(values); },
        (fieldErrors) => toast.error(fieldErrors.email?.message ?? fieldErrors.password?.message ?? 'Please check your details.')
      )}
    >
      <h1 className="text-xl font-semibold">Log in to NearMe</h1>
      <Input label="Email" type="email" inputMode="email" autoComplete="email" disabled={mutation.isPending} error={errors.email?.message} {...register('email')} />
      <Input label="Password" type="password" autoComplete="current-password" disabled={mutation.isPending} error={errors.password?.message} {...register('password')} />
      <label className="flex items-center gap-2 text-sm">
        <input className="h-5 w-5 accent-brand-600" type="checkbox" disabled={mutation.isPending} {...register('rememberMe')} />
        Remember me
      </label>
      <Button type="submit" isLoading={mutation.isPending}>
        Log in
      </Button>
      <div className="flex justify-between text-sm">
        <Link to="/forgot-password" className="text-indigo-600 hover:underline">
          Forgot password?
        </Link>
        <Link to="/register" className="text-indigo-600 hover:underline">
          Create an account
        </Link>
      </div>
      <div className="my-2 text-center text-xs uppercase text-gray-400">or</div>
      <GoogleButton />
    </form>
  );
}
