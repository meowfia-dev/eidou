/**
 * ErrorGlitch Component
 *
 * Displays a visually distinct error state when EUIP rendering fails.
 * Used for:
 * - Unknown component types
 * - Hierarchy violations (nested shards, wrong parent)
 * - Missing required props
 *
 * Design: Cyberpunk glitch aesthetic with danger colors and pulse animation.
 */

import React from 'react';

export interface ErrorGlitchProps {
  /** The component type that caused the error */
  type?: string;
  /** Human-readable error message */
  message?: string;
  /** Error code for categorization */
  code?: 'ERR_UNKNOWN_TYPE' | 'ERR_HIERARCHY' | 'ERR_MISSING_PROPS';
}

export const ErrorGlitch: React.FC<ErrorGlitchProps> = ({
  type,
  message,
  code,
}) => {
  // Determine error code from context if not provided
  const errorCode = code || (message ? 'ERR_HIERARCHY' : 'ERR_UNKNOWN_TYPE');

  return (
    <div
      className="border border-danger/50 bg-danger/20 p-2 text-danger font-mono text-xs animate-pulse rounded-none"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center gap-2">
        <span className="text-danger/80">[{errorCode}]</span>
        {type && <span className="uppercase font-bold">{type}</span>}
      </div>
      {message && (
        <div className="mt-1 opacity-75 text-[10px] leading-tight">
          {message}
        </div>
      )}
    </div>
  );
};

ErrorGlitch.displayName = 'ErrorGlitch';
