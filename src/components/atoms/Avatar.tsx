import React, { forwardRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { Text } from './Text';

interface AvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'square' | 'rounded';
  status?: 'online' | 'offline' | 'busy' | 'away';
  className?: string;
  style?: React.CSSProperties;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
};

const shapeClasses = {
  circle: 'rounded-none',
  square: 'rounded-none',
  rounded: 'rounded-none',
};

const statusColors = {
  online: 'bg-success',
  offline: 'bg-muted/40',
  busy: 'bg-danger',
  away: 'bg-warning',
};

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(({
  src,
  alt = 'Avatar',
  fallback,
  size = 'md',
  shape = 'circle',
  status,
  className,
  style,
}, ref) => {
  const [hasError, setHasError] = useState(false);

  const showImage = src && !hasError;

  return (
    <div
      ref={ref}
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden bg-card border border-primary/20",
        sizeClasses[size],
        shapeClasses[shape],
        className
      )}
      style={style}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <Text
          content={fallback || alt.charAt(0).toUpperCase()}
          variant="label"
          weight="bold"
          color="foreground"
          colorOpacity="80"
        />
      )}
      
      {/* Glitch Overlay Effect */}
      <div className="absolute inset-0 bg-primary/5 pointer-events-none mix-blend-overlay" />

      {/* Status Indicator Dot */}
      {status && (
        <div
          className={cn(
            "absolute top-0 right-0 w-3 h-3 rounded-none border-2 border-card",
            statusColors[status]
          )}
        />
      )}
    </div>
  );
});

Avatar.displayName = "Avatar";
