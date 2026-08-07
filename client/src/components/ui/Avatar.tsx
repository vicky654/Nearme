import { useState } from 'react';
import { getValidAvatarUrl, getFunkyAvatarUrl } from '../../utils/avatarUtils';

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  seed?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'custom';
  shape?: 'circle' | 'squircle';
  className?: string;
  imgClassName?: string;
  showOnlineStatus?: boolean;
  isOnline?: boolean;
  border?: boolean;
  shadow?: boolean;
  onClick?: () => void;
}

const sizeClasses = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-14 w-14 text-xl',
  xl: 'h-20 w-20 text-2xl',
  '2xl': 'h-32 w-32 text-4xl',
  custom: '',
};

const shapeClasses = {
  circle: 'rounded-full',
  squircle: 'rounded-[1.2rem]',
};

const squircleSizeClasses = {
  xs: 'rounded-md',
  sm: 'rounded-xl',
  md: 'rounded-2xl',
  lg: 'rounded-[1.4rem]',
  xl: 'rounded-[1.8rem]',
  '2xl': 'rounded-[2.2rem]',
  custom: 'rounded-[1.2rem]',
};

export function Avatar({
  src,
  alt = 'User avatar',
  seed,
  size = 'md',
  shape = 'circle',
  className = '',
  imgClassName = '',
  showOnlineStatus = false,
  isOnline = false,
  border = false,
  shadow = false,
  onClick,
}: AvatarProps) {
  const fallbackSeed = seed || alt || 'explorer';
  const initialUrl = getValidAvatarUrl(src, fallbackSeed);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);

  const roundedClass = shape === 'squircle' ? squircleSizeClasses[size] : shapeClasses.circle;
  const sizeClass = sizeClasses[size];

  function handleError() {
    // If the image fails to load for any reason, fallback to a deterministic funky avatar
    setCurrentUrl(getFunkyAvatarUrl(fallbackSeed));
  }

  return (
    <div
      onClick={onClick}
      className={`relative inline-block shrink-0 ${sizeClass} ${onClick ? 'cursor-pointer transition-transform hover:scale-105' : ''} ${className}`}
    >
      <img
        src={currentUrl}
        alt={alt}
        onError={handleError}
        className={`h-full w-full object-cover bg-gray-100 dark:bg-gray-800 ${roundedClass} ${
          border ? 'border-2 border-white dark:border-gray-900' : ''
        } ${shadow ? 'shadow-md' : ''} ${imgClassName}`}
      />
      {showOnlineStatus && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-gray-900 ${
            size === 'xs' || size === 'sm' ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'
          } ${isOnline ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
        />
      )}
    </div>
  );
}
