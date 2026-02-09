import React, { forwardRef } from 'react';
import { useCommittedTextInput } from '../../lib/hooks/useCommittedTextInput';
import { USER_ACTION_IDS } from '../../lib/protocol';
import { cn } from '../../lib/utils';

interface InputProps {
  placeholder?: string;
  value?: string;
  name: string;
  type?: 'text' | 'password' | 'number' | 'email' | 'url' | 'tel' | 'date' | 'time';
  trigger?: 'blur' | 'change';
  disabled?: boolean;
  error?: boolean | string;
  className?: string;
  style?: React.CSSProperties;
  action?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  placeholder,
  value = '',
  name,
  type = 'text',
  trigger = 'blur',
  disabled = false,
  error = false,
  className,
  style,
  action,
}, ref) => {
  const {
    localValue,
    onChange,
    onBlurCommit,
    onEnterCommit
  } = useCommittedTextInput({
    name,
    value,
    trigger,
    actionId: action || USER_ACTION_IDS.INPUT_CHANGE,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    onChange(e.target.value);
  };

  const hasError = !!error;
  const errorMessage = typeof error === 'string' ? error : undefined;

  return (
    <div className="relative group w-full" style={style}>
      <input
        ref={ref}
        type={type}
        name={name}
        value={localValue}
        onChange={handleChange}
        onBlur={onBlurCommit}
        onKeyDown={onEnterCommit}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          // Base
          "w-full px-4 py-2 bg-card text-foreground font-mono text-sm",
          // Border (v4: always 2px, color fades on focus)
          hasError ? "border-2 border-danger" : "border-2 border-primary/10",
          "rounded-none",
          // Focus
          hasError 
            ? "focus:border-danger focus:shadow-danger-glow focus:outline-none" 
            : "focus:border-primary focus:shadow-neon-dim focus:outline-none",
          // Placeholder
          "placeholder:text-foreground/40",
          // Disabled
          "disabled:opacity-50 disabled:cursor-not-allowed",
          // Transition
          "transition-all duration-100",
          className
        )}
      />
      {/* Corner Accent (Cyberpunk detail) */}
      <div className={cn(
        "absolute top-0 right-0 w-2 h-2 border-t border-r transition-opacity pointer-events-none",
        hasError ? "border-danger opacity-100" : "border-primary opacity-50 group-hover:opacity-100"
      )} />
      
      {/* Error Message */}
      {errorMessage && (
        <div className="mt-1 text-xs text-danger font-mono">
          {errorMessage}
        </div>
      )}
    </div>
  );
});

Input.displayName = "Input";
