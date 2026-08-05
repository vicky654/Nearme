import { ComponentPropsWithoutRef, forwardRef, useId, useState } from 'react';

export interface InputProps extends ComponentPropsWithoutRef<'input'> {
  label: string;
  error?: string;
  showPasswordToggle?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, type, showPasswordToggle, className = '', ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const isPasswordType = type === 'password';
    const enableToggle = showPasswordToggle ?? isPasswordType;
    const [showPassword, setShowPassword] = useState(false);

    const inputType = enableToggle && isPasswordType ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-xs font-bold text-gray-600 dark:text-gray-300">
          {label}
        </label>
        <div className="relative flex items-center">
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className={`min-h-12 w-full rounded-2xl border bg-gray-50/80 px-4 py-3 text-sm shadow-inner shadow-gray-100/50 transition focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:bg-gray-950/50 dark:text-gray-100 dark:shadow-none ${
              enableToggle ? 'pr-10' : ''
            } ${error ? 'border-red-500' : 'border-gray-200 focus:border-brand-500 dark:border-gray-700'} ${className}`}
            {...props}
          />
          {enableToggle && isPasswordType && (
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 p-1 text-gray-500 hover:text-gray-700 focus:outline-none dark:text-gray-400 dark:hover:text-gray-200"
            >
              {showPassword ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.025 10.025 0 0110.122 3.937M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
