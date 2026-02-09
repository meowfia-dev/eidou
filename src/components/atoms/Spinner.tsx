import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 32,
};

export const Spinner = forwardRef<HTMLDivElement, SpinnerProps>(({
  size = 'md',
  label,
  className,
  style,
}, ref) => {
  return (
    <div 
      ref={ref}
      className={cn("flex items-center justify-center text-current", className)} 
      style={style}
      role="status"
      aria-label={label || "Loading"}
    >
      <Loader2 
        className="animate-spin" 
        size={sizeMap[size]} 
      />
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
});

Spinner.displayName = "Spinner";
