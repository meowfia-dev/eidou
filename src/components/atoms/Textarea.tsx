import React, { forwardRef } from 'react';
import { useCommittedTextInput } from '../../lib/hooks/useCommittedTextInput';
import { USER_ACTION_IDS } from '../../lib/protocol';
import { cn } from '../../lib/utils';

interface TextareaProps {
  name: string;
  value?: string;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  readOnly?: boolean;
  trigger?: 'blur' | 'change';
  error?: boolean | string;
  className?: string;
  style?: React.CSSProperties;
  action?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  name,
  value = '',
  placeholder,
  rows = 3,
  maxLength,
  disabled,
  readOnly,
  trigger = 'blur',
  error = false,
  className,
  style,
  action,
}, ref) => {
  const {
    localValue,
    onChange,
    onBlurCommit
  } = useCommittedTextInput({
    name,
    value,
    trigger,
    actionId: action || USER_ACTION_IDS.INPUT_CHANGE,
  });

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (disabled) return;
    onChange(e.target.value);
  };

  const hasError = !!error;
  const errorMessage = typeof error === 'string' ? error : undefined;

  return (
    <div className="relative group w-full" style={style}>
      <textarea
        ref={ref}
        name={name}
        value={localValue}
        onChange={handleChange}
        onBlur={onBlurCommit}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        readOnly={readOnly}
        className={cn(
          // Base
          "w-full px-4 py-2 bg-card text-foreground font-mono text-sm resize-y",
          // Border (v4: always 2px, color fades on focus)
          hasError ? "border-2 border-danger" : "border-2 border-primary/10",
          "rounded-none",
          // Focus
          hasError 
            ? "focus:border-danger focus:shadow-danger-glow focus:outline-none" 
            : "focus:border-primary focus:shadow-neon-dim focus:outline-none",
          // Placeholder
          "placeholder:text-foreground/40",
          // Disabled/ReadOnly
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "readOnly:opacity-80 readOnly:cursor-default",
          // Transition
          "transition-all duration-100",
          className
        )}
      />
      {/* Corner Accent */}
      <div className={cn(
        "absolute top-0 right-0 w-2 h-2 border-t border-r transition-opacity pointer-events-none",
        hasError ? "border-danger opacity-100" : "border-primary opacity-50 group-hover:opacity-100"
      )} />
      
      {/* Optional Character Count Indicator if maxLength is present (Cyberpunk style) */}
      {maxLength && (
        <div className="absolute bottom-2 right-2 text-[10px] text-primary/40 font-mono pointer-events-none">
          {localValue.length}/{maxLength}
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="mt-1 text-xs text-danger font-mono">
          {errorMessage}
        </div>
      )}
    </div>
  );
});

Textarea.displayName = "Textarea";
