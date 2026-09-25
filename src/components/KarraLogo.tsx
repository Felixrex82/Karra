import React from 'react';

interface KarraLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  className?: string;
  variant?: 'green-bg' | 'icon-only' | 'light-green-bg';
}

export const KarraLogo: React.FC<KarraLogoProps> = ({
  size = 'md',
  showWordmark = false,
  className = '',
  variant = 'green-bg',
}) => {
  const sizeMap = {
    xs: { box: 'w-6 h-6', icon: 24, font: 'text-sm' },
    sm: { box: 'w-8 h-8', icon: 32, font: 'text-base' },
    md: { box: 'w-10 h-10', icon: 40, font: 'text-lg' },
    lg: { box: 'w-12 h-12', icon: 48, font: 'text-xl' },
    xl: { box: 'w-16 h-16', icon: 64, font: 'text-2xl' },
  };

  const { box, font } = sizeMap[size];

  return (
    <div className={`inline-flex items-center space-x-2.5 ${className}`}>
      {/* Brand Icon with exact leaf-K geometry on deep forest green */}
      <div
        className={`${box} rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-transform overflow-hidden ${
          variant === 'green-bg'
            ? 'bg-[#086947] text-white'
            : variant === 'light-green-bg'
            ? 'bg-emerald-50 dark:bg-[#086947] border border-emerald-200 dark:border-emerald-800'
            : 'text-[#086947] dark:text-emerald-400'
        }`}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-[82%] h-[82%]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Vertical Capsule Pillar */}
          <rect
            x="20"
            y="18"
            width="17"
            height="64"
            rx="8.5"
            fill={variant === 'icon-only' ? 'currentColor' : '#FFFFFF'}
          />

          {/* Upper Wing / Leaf Petal */}
          <path
            d="M 41 50 C 41 38 48 22 76 19 C 81 19 83 23 82 27 C 79 43 65 54 41 53 Z"
            fill={variant === 'icon-only' ? 'currentColor' : '#FFFFFF'}
          />

          {/* Lower Wing / Leaf Petal */}
          <path
            d="M 41 55 C 65 54 79 65 82 81 C 83 85 81 89 76 89 C 48 86 41 70 41 58 Z"
            fill={variant === 'icon-only' ? 'currentColor' : '#FFFFFF'}
          />
        </svg>
      </div>

      {/* Brand Wordmark */}
      {showWordmark && (
        <div className="flex flex-col">
          <span className={`font-extrabold tracking-tight text-slate-900 dark:text-white leading-none ${font}`}>
            Karra
          </span>
          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold tracking-wide uppercase mt-0.5">
            Business OS
          </span>
        </div>
      )}
    </div>
  );
};
