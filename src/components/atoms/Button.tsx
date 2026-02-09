import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { emitUserEvent } from '../../lib/events';
import { Spinner } from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  action: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ 
  label, 
  action,
  variant = 'primary', 
  className, 
  onClick,
  style,
  disabled = false,
  loading = false,
  ...props 
}, ref) => {
  const variants = {
    primary: "bg-primary/10 border-primary text-primary hover:bg-primary-bright hover:text-primary-foreground hover:shadow-neon",
    secondary: "bg-muted/5 border-border/20 text-foreground hover:bg-muted/10 hover:border-border/40",
    ghost: "bg-muted/0 border-border/10 text-foreground/70 hover:bg-muted/5 hover:border-border/20 hover:text-foreground",
    danger: "bg-danger/10 border-danger text-danger hover:bg-danger hover:text-danger-foreground hover:shadow-danger-glow"
  };

  const handleInteraction = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (loading || disabled) return;
    if (onClick) onClick(e);

    if (action) {
      await emitUserEvent(action);
    }
  };

  const isMissingAction = !action;
  const isDisabled = disabled || loading || isMissingAction;

  return (
    <button 
      ref={ref}
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 px-6 py-2 border rounded-none font-mono text-sm font-bold uppercase tracking-wider transition-all duration-100 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
      onClick={handleInteraction}
      disabled={isDisabled}
      title={props.title || (isMissingAction ? "ERR_MISSING_ACTION" : undefined)}
      style={style}
    >
      {loading && <Spinner size="sm" />}
      {label || props.children}
    </button>
  );
});

Button.displayName = "Button";
