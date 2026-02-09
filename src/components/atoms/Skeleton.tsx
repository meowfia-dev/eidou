import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  variant?: 'pulse' | 'scan' | 'glitch';
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(({
  width,
  height,
  variant = 'pulse',
  className,
  style,
  children,
  ...props
}, ref) => {
  
  const variantStyles = {
    pulse: "animate-pulse bg-primary/20 border border-primary/20",
    scan: "relative overflow-hidden bg-primary/10 border border-primary/20",
    glitch: "bg-primary/20 animate-pulse border border-primary/20", 
  };

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-none",
        variantStyles[variant],
        className
      )}
      style={{
        width,
        height,
        ...style,
      }}
      {...props}
    >
      {variant === 'scan' && (
        <div className="absolute inset-0 translate-x-[-100%] animate-scan bg-gradient-to-r from-primary/0 via-primary/60 to-primary/0" />
      )}
      {children}
    </div>
  );
});

Skeleton.displayName = "Skeleton";
