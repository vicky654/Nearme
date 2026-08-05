import { ComponentPropsWithoutRef, forwardRef } from 'react';

export interface ButtonProps
  extends Omit<ComponentPropsWithoutRef<'button'>, 'onAnimationStart' | 'onAnimationEnd' | 'onDrag' | 'onDragStart' | 'onDragEnd'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-brand-600 text-white shadow-lg shadow-brand-600/20 hover:bg-brand-500 hover:shadow-brand-500/30 active:scale-[.98] disabled:bg-brand-500',
  secondary:
    'border border-gray-200 bg-white text-gray-800 shadow-sm hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-brand-700 dark:hover:bg-gray-700',
  ghost: 'bg-transparent text-gray-900 hover:bg-brand-50 hover:text-brand-700 dark:text-gray-100 dark:hover:bg-gray-800 dark:hover:text-brand-300',
  danger: 'bg-red-600 text-white shadow-lg shadow-red-600/15 hover:bg-red-500 active:scale-[.98] disabled:bg-red-400',
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'min-h-10 px-3.5 py-2 text-xs',
  md: 'min-h-11 px-5 py-2.5 text-sm',
  lg: 'min-h-12 px-6 py-3 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading = false, disabled, className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all duration-200 active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {isLoading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
