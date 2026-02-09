import React from 'react';

/**
 * ErrorBoundary for Ghost Render (RFC-004 Phase 2: MOUNTING).
 *
 * Wraps the invisible Ghost Container render. If the EUIP content tree
 * throws during React rendering, this boundary captures the error and
 * reports it via the onError callback so the state machine can abort
 * materialization gracefully.
 *
 * @see /docs/rfc/004-materialization-protocol.md Section 3 (Phase 2)
 */

export interface GhostErrorBoundaryProps {
  /** Called when a render error is caught. */
  onError: (error: string) => void;
  children: React.ReactNode;
}

interface GhostErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class GhostErrorBoundary extends React.Component<
  GhostErrorBoundaryProps,
  GhostErrorBoundaryState
> {
  constructor(props: GhostErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: unknown): GhostErrorBoundaryState {
    const message =
      error instanceof Error ? error.message : String(error);
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    const message =
      error instanceof Error ? error.message : String(error);
    if (import.meta.env.DEV) {
      console.error(
        '[GhostErrorBoundary] Render failed during ghost mount:',
        error,
        info.componentStack,
      );
    }
    this.props.onError(message);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      // Render nothing -- the parent state machine handles the abort.
      return null;
    }
    return this.props.children;
  }
}
