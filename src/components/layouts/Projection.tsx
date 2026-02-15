/**
 * Projection -- Phase-Aware Widget Container (RFC-004)
 *
 * The outermost layout component for every EUIP widget. Manages the
 * materialization lifecycle:
 *   With Seed:    VOID -> SEEDING -> SHAPING -> REVEALING -> ENTERING -> IDLE
 *   Without Seed: VOID -> MOUNTING -> SHAPING -> REVEALING -> ENTERING -> IDLE
 *
 * Phase 1 (Shadow Render):
 *   - State machine integration (projectionReducer)
 *   - Ghost Container for invisible measurement
 *   - GhostErrorBoundary for safe render attempts
 *   - Phase-based CSS class application
 *
 * Phase 2 (Auto Scale):
 *   - SizeSpec parsing (auto / sm / md / lg / explicit / hybrid)
 *   - Ghost Container respects fixed axes for hybrid measurement
 *   - Size constraint clamping (85% rule, 1024px cap, anti-spaghetti)
 *   - adjust_projection_size IPC to Rust for window resize
 *   - ResizeObserver for IDLE-phase dynamic content resize
 *
 * Phase 3 (Holographic Seed):
 *   - Seed capsule rendered during SEEDING phase (200x56px, decode text)
 *   - Concurrent ghost measurement alongside Seed display
 *   - Minimum Seed display time (300ms normal, 150ms fast)
 *   - Seed -> SHAPING transition once both timer + measurement complete
 *
 * Phase 4 (Transition In/Out):
 *   - Variant-based CSS enter/exit animations (6 core variants)
 *   - ENTERING: content wrapper gets animation style, animationend listener
 *   - EXITING: triggered by onCloseRequested, plays exit animation
 *   - Speed-aware animation durations + fallback timeouts
 *   - onExitComplete callback for finalize_close IPC
 *
 * @see /docs/rfc/004-materialization-protocol.md
 */

import React, { useReducer, useEffect, useRef, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { cn } from '../../lib/utils';
import {
  projectionReducer,
  INITIAL_STATE,
  type ProjectionPhase,
} from '../../lib/projection-state';
import {
  type SizeSpec,
  parseSizeSpec,
  needsMeasurement,
  isHybridAutoAxis,
  resolveFinalSize,
  shouldApplyHybridCorrection,
  getScreenInfo,
} from '../../lib/size-constraints';
import { ProjectionSizingProvider } from '../../lib/projection-sizing';
import { requestProjectionResize } from '../../lib/projection-window';
import { diagnoseInteractiveReachability } from '../../lib/reachability';
import { GhostErrorBoundary } from '../system/ErrorBoundary';
import { Seed } from '../system/Seed';
import type { TransitionDefinition } from '../providers/ThemeProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Transition configuration for the materialization animation.
 * Controls Seed display, animation variant, and timing.
 *
 * @see /docs/rfc/004-materialization-protocol.md Section 8.2
 */
export interface TransitionProps {
  /** Animation variant: determines Seed label pool and CSS animation set. */
  variant?: string;
  /** Speed preset: affects Seed minimum display time and animation durations. */
  speed?: 'fast' | 'normal' | 'slow';
  /**
   * Whether to show the Seed (pre-loader capsule) before content.
   * Defaults to true. Set false to skip Seed and go straight to Shadow Render.
   */
  seed?: boolean;
}

interface ProjectionProps {
  title?: string;
  size?: SizeSpec;
  transition?: TransitionProps;
  /**
   * Theme-level transition definitions, keyed by variant name.
   * Passed from ProjectionEngine after merging host + protocol themes.
   * Provides duration overrides and custom Seed label pools.
   *
   * Resolution priority (RFC-004 Section 9.2):
   *   Protocol speed prop > Theme transitions > Core defaults
   */
  themeTransitions?: Record<string, TransitionDefinition>;
  /**
   * When set to true, triggers the EXITING phase (plays exit animation).
   * Controlled by App.tsx in response to eidou:request_close events.
   */
  closing?: boolean;
  /**
   * Called when the exit animation completes. The parent (App.tsx) should
   * invoke finalize_close IPC to tell Rust it's safe to hide the window.
   */
  onExitComplete?: () => void;
  children: React.ReactNode;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum Seed display time by speed preset (ms). */
const SEED_MIN_DURATION: Record<string, number> = {
  fast: 600,
  normal: 1200,
  slow: 2000,
};

/**
 * Enter animation duration by speed preset (ms).
 * @see /docs/rfc/004-materialization-protocol.md Section 7.3
 */
const ENTER_DURATION: Record<string, number> = {
  fast: 150,
  normal: 300,
  slow: 500,
};

/**
 * Exit animation duration by speed preset (ms).
 * @see /docs/rfc/004-materialization-protocol.md Section 7.3
 */
const EXIT_DURATION: Record<string, number> = {
  fast: 100,
  normal: 200,
  slow: 300,
};

/**
 * Reveal animation duration by speed preset (ms).
 * Clip-path expansion from seed center to full size.
 * @see /docs/rfc/004-materialization-protocol.md Section 7.3
 */
const REVEAL_DURATION: Record<string, number> = {
  fast: 350,
  normal: 600,
  slow: 800,
};

/** Extra ms added to animation duration for the fallback timeout. */
const ANIMATION_TIMEOUT_BUFFER = 200;

/**
 * Hold duration after decode completes before advancing, by speed preset (ms).
 * Gives the user time to read the decoded label.
 */
const HOLD_DURATION: Record<string, number> = {
  fast: 200,
  normal: 400,
  slow: 600,
};

/**
 * Decode tick interval by speed preset (ms).
 * Slower tick = more deliberate character reveal.
 */
const DECODE_TICK_MS: Record<string, number> = {
  fast: 35,
  normal: 50,
  slow: 70,
};

/**
 * Known animation variants. Used to resolve CSS animation name.
 * Unknown variants fall back to 'default'.
 */
const KNOWN_VARIANTS = new Set([
  'default', 'tactical', 'glitch', 'stealth', 'alert', 'success',
]);

// ResizeObserver constants: disabled pending intrinsic measurement fix (H2/H3).
// const RESIZE_THRESHOLD = 5;
// const RESIZE_DEBOUNCE = 100;

/**
 * Resolve enter duration from the three-layer priority:
 *   1. Protocol speed preset (explicit speed prop)
 *   2. Theme transition definition (enter.duration)
 *   3. Core defaults (ENTER_DURATION map)
 */
function resolveEnterDuration(
  speed: string,
  variant: string,
  themeTransitions?: Record<string, TransitionDefinition>,
): number {
  // Layer 1: Protocol speed always wins when explicitly provided
  const coreDuration = ENTER_DURATION[speed] ?? ENTER_DURATION.normal;

  // Layer 2: Check theme for variant-specific or default override
  if (themeTransitions) {
    const themeDef = themeTransitions[variant] ?? themeTransitions['default'];
    if (themeDef?.enter?.duration != null) {
      // If speed is 'normal' (the default), theme overrides apply.
      // If speed is explicitly non-default, protocol speed wins.
      if (speed === 'normal') return themeDef.enter.duration;
    }
  }

  // Layer 3: Core defaults
  return coreDuration;
}

/**
 * Resolve exit duration from the three-layer priority.
 * Same logic as resolveEnterDuration.
 */
function resolveExitDuration(
  speed: string,
  variant: string,
  themeTransitions?: Record<string, TransitionDefinition>,
): number {
  const coreDuration = EXIT_DURATION[speed] ?? EXIT_DURATION.normal;

  if (themeTransitions) {
    const themeDef = themeTransitions[variant] ?? themeTransitions['default'];
    if (themeDef?.exit?.duration != null) {
      if (speed === 'normal') return themeDef.exit.duration;
    }
  }

  return coreDuration;
}

/**
 * Resolve reveal duration from the three-layer priority.
 * Same logic as resolveEnterDuration but using REVEAL_DURATION defaults.
 */
function resolveRevealDuration(
  speed: string,
  variant: string,
  themeTransitions?: Record<string, TransitionDefinition>,
): number {
  const coreDuration = REVEAL_DURATION[speed] ?? REVEAL_DURATION.normal;

  if (themeTransitions) {
    const themeDef = themeTransitions[variant] ?? themeTransitions['default'];
    if (themeDef?.reveal?.duration != null) {
      if (speed === 'normal') return themeDef.reveal.duration;
    }
  }

  return coreDuration;
}

/**
 * Resolve Seed label pool: theme overrides > core built-in pools.
 * Returns undefined if no custom labels (Seed uses its built-in pools).
 */
function resolveSeedLabels(
  variant: string,
  themeTransitions?: Record<string, TransitionDefinition>,
): string[] | undefined {
  if (!themeTransitions) return undefined;
  const themeDef = themeTransitions[variant];
  if (themeDef?.seed_labels && themeDef.seed_labels.length > 0) {
    return themeDef.seed_labels;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map phase to CSS class for Projection container. */
function phaseClass(phase: ProjectionPhase): string {
  return `projection-phase-${phase}`;
}

/**
 * Call Rust adjust_projection_size to resize the OS window.
 * Resize only -- no repositioning. The backend owns initial placement;
 * frontend resize must not override it (fixes widget centering bug).
 */
async function adjustWindowSize(
  width: number,
  height: number,
): Promise<void> {
  const win = getCurrentWindow();
  await requestProjectionResize({
    windowLabel: win.label,
    width,
    height,
  });
}

/** Resolve variant string to a known CSS animation variant name. */
function resolveVariant(variant: string): string {
  return KNOWN_VARIANTS.has(variant) ? variant : 'default';
}

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

/**
 * Build the CSS animation shorthand for enter/exit.
 * Maps to keyframes defined in index.css: eidou-enter-{variant}, eidou-exit-{variant}
 * Uses three-layer priority for duration resolution.
 */
function buildAnimationStyle(
  direction: 'enter' | 'exit',
  variant: string,
  speed: string,
  themeTransitions?: Record<string, TransitionDefinition>,
): React.CSSProperties {
  const resolved = resolveVariant(variant);
  const durationMs = direction === 'enter'
    ? resolveEnterDuration(speed, resolved, themeTransitions)
    : resolveExitDuration(speed, resolved, themeTransitions);
  const fillMode = direction === 'exit' ? 'forwards' : 'both';
  return {
    animation: `eidou-${direction}-${resolved} ${durationMs}ms ease-out ${fillMode}`,
  };
}

/**
 * Build CSS animation shorthand for the REVEALING phase.
 * Maps to keyframes: eidou-reveal-{variant} in index.css.
 * Uses three-layer priority for duration resolution.
 */
function buildRevealStyle(
  variant: string,
  speed: string,
  themeTransitions?: Record<string, TransitionDefinition>,
): React.CSSProperties {
  const resolved = resolveVariant(variant);
  const durationMs = resolveRevealDuration(speed, resolved, themeTransitions);
  return {
    animation: `eidou-reveal-${resolved} ${durationMs}ms cubic-bezier(0.16, 1, 0.3, 1) both`,
    // Sync duration to seed-echo pseudo-element via CSS custom property
    '--eidou-reveal-duration': `${durationMs}ms`,
  } as React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Projection: React.FC<ProjectionProps> = ({ size, transition, themeTransitions, closing, onExitComplete, children, className }) => {
  const [state, dispatch] = useReducer(projectionReducer, INITIAL_STATE);
  const ghostRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);
  const lastResizedSize = useRef<{ width: number; height: number } | null>(null);
  const exitCompletedRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parsed = parseSizeSpec(size, getScreenInfo());
  const requiresMeasurement = needsMeasurement(parsed);

  // Resolve transition configuration
  const hasSeed = transition?.seed !== false;
  const seedVariant = transition?.variant ?? 'default';
  const seedSpeed = transition?.speed ?? 'normal';
  const seedLabels = resolveSeedLabels(seedVariant, themeTransitions);

  // -- Cleanup hold timer on unmount ----------------------------------------
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  // -- Decode complete handler: hold for readability, then signal state ------
  const handleDecodeComplete = useCallback(() => {
    const holdMs = HOLD_DURATION[seedSpeed] ?? HOLD_DURATION.normal;
    holdTimerRef.current = setTimeout(() => {
      dispatch({ type: 'SEED_DECODE_COMPLETE' });
    }, holdMs);
  }, [seedSpeed]);

  // -- Respond to closing prop (eidou:request_close from parent) -----------
  useEffect(() => {
    if (closing) {
      dispatch({ type: 'CLOSE_REQUESTED' });
    }
  }, [closing]);

  // -- Mid-lifecycle close: forced VOID while closing (C1 fix) -------------
  // When CLOSE_REQUESTED fires during pre-IDLE phases, the reducer forces
  // state to VOID without going through EXITING. Rust never receives
  // finalize_close -> zombie window. Detect and handle immediately.
  useEffect(() => {
    if (state.phase === 'VOID' && closing && onExitComplete) {
      if (!exitCompletedRef.current) {
        exitCompletedRef.current = true;
        onExitComplete();
      }
    }
  }, [state.phase, closing, onExitComplete]);

  // -- Kick off materialization on first render with content ----------------
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    dispatch({ type: 'START_MATERIALIZATION', hasSeed });
  }, [hasSeed]);

  // -- Ghost Container measurement (MOUNTING or SEEDING phase) ---------------
  // During SEEDING, the ghost renders concurrently alongside the visible Seed.
  // During MOUNTING (no seed), ghost is the only thing happening.
  useEffect(() => {
    const isMeasuringPhase = state.phase === 'MOUNTING' || state.phase === 'SEEDING';
    if (!isMeasuringPhase) return;

    if (!requiresMeasurement) {
      // Fixed size -- skip ghost measurement entirely.
      // Report the fixed dimensions so SHAPING can use them.
      dispatch({
        type: 'GHOST_RENDER_COMPLETE',
        width: parsed.width ?? 480,
        height: parsed.height ?? 640,
      });
      return;
    }

    // Use rAF to ensure the browser has painted the ghost content
    // before we measure it.
    const frame = requestAnimationFrame(() => {
      const el = ghostRef.current;
      if (!el) {
        dispatch({ type: 'GHOST_RENDER_FAILED', error: 'Ghost ref not available' });
        return;
      }

      const width = el.scrollWidth;
      const height = el.scrollHeight;

      dispatch({ type: 'GHOST_RENDER_COMPLETE', width, height });
    });

    return () => cancelAnimationFrame(frame);
  }, [state.phase, requiresMeasurement, parsed.width, parsed.height]);

  // -- SEEDING: minimum display timer ---------------------------------------
  useEffect(() => {
    if (state.phase !== 'SEEDING') return;

    const duration = SEED_MIN_DURATION[seedSpeed] ?? SEED_MIN_DURATION.normal;
    const timer = setTimeout(() => {
      dispatch({ type: 'SEED_MINIMUM_ELAPSED' });
    }, duration);

    return () => clearTimeout(timer);
  }, [state.phase, seedSpeed]);

  // -- SHAPING: resolve final size + call adjust_projection_size -----------
  useEffect(() => {
    if (state.phase !== 'SHAPING') return;

    // Non-seed widgets with fixed size: skip IPC entirely to preserve
    // backend-set position (fixes toast/widget centering bug).
    if (!hasSeed && parsed.width !== null && parsed.height !== null) {
      dispatch({ type: 'RESIZE_CONFIRMED' });
      return;
    }

    const screen = getScreenInfo();
    const finalSize = resolveFinalSize(size, state.measuredSize, screen);

    const canRunHybridCorrection = isHybridAutoAxis(parsed);

    // Store for ResizeObserver comparison
    lastResizedSize.current = finalSize;

    let cancelled = false;

    const runShapingResize = async () => {
      try {
        // First pass resize from ghost measurement
        await adjustWindowSize(finalSize.width, finalSize.height);

        let appliedSize = finalSize;

        // Hybrid-only correction pass (at most once): account for runtime
        // width rounding after Tauri resize that can increase wrapped height.
        if (canRunHybridCorrection) {
          await waitForAnimationFrame();

          const contentEl = contentRef.current;
          if (contentEl) {
            const runtimeMeasured = {
              width: contentEl.scrollWidth,
              height: contentEl.scrollHeight,
            };
            const correctedSize = resolveFinalSize(size, runtimeMeasured, screen);

            if (shouldApplyHybridCorrection(finalSize, correctedSize, parsed)) {
              await adjustWindowSize(correctedSize.width, correctedSize.height);
              appliedSize = correctedSize;
            }
          }
        }

        lastResizedSize.current = appliedSize;
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('[Projection] adjust_projection_size failed:', err);
        }
      } finally {
        if (!cancelled) {
          // Always proceed. If resize failed, window keeps current size.
          dispatch({ type: 'RESIZE_CONFIRMED' });
        }
      }
    };

    runShapingResize();

    return () => {
      cancelled = true;
    };
  }, [state.phase, size, state.measuredSize, hasSeed, parsed.width, parsed.height]);

  // -- REVEALING: play reveal (clip-path expansion) animation ---------------
  useEffect(() => {
    if (state.phase !== 'REVEALING') return;

    let el: HTMLDivElement | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const frame = requestAnimationFrame(() => {
      if (import.meta.env.DEV && contentRef.current) {
        const report = diagnoseInteractiveReachability(contentRef.current);
        if (report.unreachable.length > 0) {
          console.warn('[Projection] Unreachable interactive elements detected before reveal', report);
        }
      }

      // Non-seed widgets: skip reveal animation, go straight to ENTERING.
      // Toasts/widgets without seed get: MOUNTING -> SHAPING(instant) -> REVEALING(instant) -> ENTERING.
      if (!hasSeed) {
        dispatch({ type: 'REVEAL_ANIMATION_COMPLETE' });
        return;
      }

      el = revealRef.current;
      if (el) {
        el.addEventListener('animationend', handleAnimationEnd);
      }

      // Fallback timeout in case animationend never fires.
      const revealMs = resolveRevealDuration(seedSpeed, resolveVariant(seedVariant), themeTransitions);
      timeout = setTimeout(() => {
        dispatch({ type: 'REVEAL_ANIMATION_COMPLETE' });
      }, revealMs + ANIMATION_TIMEOUT_BUFFER);
    });

    const handleAnimationEnd = (e: AnimationEvent) => {
      if (e.animationName.startsWith('eidou-reveal-')) {
        dispatch({ type: 'REVEAL_ANIMATION_COMPLETE' });
      }
    };

    return () => {
      cancelAnimationFrame(frame);
      if (el) el.removeEventListener('animationend', handleAnimationEnd);
      if (timeout) clearTimeout(timeout);
    };
  }, [state.phase, seedSpeed, seedVariant, themeTransitions, hasSeed]);

  // -- ENTERING: play enter animation, listen for animationend -------------
  useEffect(() => {
    if (state.phase !== 'ENTERING') return;

    const el = contentRef.current;

    // Listen for CSS animationend to know when the enter animation finished.
    const handleAnimationEnd = (e: AnimationEvent) => {
      // Only respond to our enter animation (ignore child animations)
      if (e.animationName.startsWith('eidou-enter-')) {
        dispatch({ type: 'ENTER_ANIMATION_COMPLETE' });
      }
    };

    if (el) {
      el.addEventListener('animationend', handleAnimationEnd);
    }

    // Fallback timeout in case animationend never fires.
    const enterMs = resolveEnterDuration(seedSpeed, resolveVariant(seedVariant), themeTransitions);
    const timeout = setTimeout(() => {
      dispatch({ type: 'ENTER_ANIMATION_COMPLETE' });
    }, enterMs + ANIMATION_TIMEOUT_BUFFER);

    return () => {
      if (el) el.removeEventListener('animationend', handleAnimationEnd);
      clearTimeout(timeout);
    };
  }, [state.phase, seedSpeed, seedVariant, themeTransitions]);

  // -- EXITING: play exit animation, call onExitComplete when done ---------
  useEffect(() => {
    if (state.phase !== 'EXITING') return;

    // Reset guard for fresh exit cycle
    exitCompletedRef.current = false;

    const el = contentRef.current;

    const completeExit = () => {
      if (exitCompletedRef.current) return;
      exitCompletedRef.current = true;
      dispatch({ type: 'EXIT_ANIMATION_COMPLETE' });
      onExitComplete?.();
    };

    const handleAnimationEnd = (e: AnimationEvent) => {
      if (e.animationName.startsWith('eidou-exit-')) {
        completeExit();
      }
    };

    if (el) {
      el.addEventListener('animationend', handleAnimationEnd);
    }

    // Fallback timeout
    const exitMs = resolveExitDuration(seedSpeed, resolveVariant(seedVariant), themeTransitions);
    const timeout = setTimeout(completeExit, exitMs + ANIMATION_TIMEOUT_BUFFER);

    return () => {
      if (el) el.removeEventListener('animationend', handleAnimationEnd);
      clearTimeout(timeout);
    };
  }, [state.phase, seedSpeed, seedVariant, themeTransitions, onExitComplete]);

  // -- IDLE: ResizeObserver for dynamic content (auto size only) -----------
  // TODO: Re-enable with intrinsic content measurement (not container size).
  // Currently disabled: the observer targets a flex-1 h-full wrapper which
  // reports container-constrained size, not natural content dimensions.
  // This breaks ScrollArea (H2) and causes resize feedback loops (H3).
  // The ghost measurement from MOUNTING still provides correct initial sizing.
  /*
  useEffect(() => {
    if (state.phase !== 'IDLE') return;
    if (!requiresMeasurement) return;

    const el = contentRef.current;
    if (!el) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const newWidth = entry.contentRect.width;
      const newHeight = entry.contentRect.height;
      const last = lastResizedSize.current;

      if (
        last &&
        Math.abs(newWidth - last.width) <= RESIZE_THRESHOLD &&
        Math.abs(newHeight - last.height) <= RESIZE_THRESHOLD
      ) {
        return; // Below threshold -- ignore
      }

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const screen = getScreenInfo();
        const finalSize = resolveFinalSize(size, { width: newWidth, height: newHeight }, screen);
        lastResizedSize.current = finalSize;
        adjustWindowSize(finalSize.width, finalSize.height).catch((err) => {
          if (import.meta.env.DEV) {
            console.error('[Projection] IDLE resize failed:', err);
          }
        });
      }, RESIZE_DEBOUNCE);
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [state.phase, requiresMeasurement, size]);
  */

  // -- Ghost render error handler ------------------------------------------
  const handleGhostError = useCallback((error: string) => {
    dispatch({ type: 'GHOST_RENDER_FAILED', error });
  }, []);

  // -- Render --------------------------------------------------------------

  const showSeed = state.phase === 'SEEDING';
  const showGhost = (state.phase === 'MOUNTING' || state.phase === 'SEEDING') && requiresMeasurement;
  const showReveal = state.phase === 'REVEALING';
  const showContent = state.phase === 'SHAPING'
    || state.phase === 'REVEALING'
    || state.phase === 'ENTERING'
    || state.phase === 'IDLE'
    || state.phase === 'EXITING';

  // Build animation style for ENTERING and EXITING phases
  const isAnimating = state.phase === 'ENTERING' || state.phase === 'EXITING';
  const animDirection = state.phase === 'EXITING' ? 'exit' : 'enter';
  const contentStyle: React.CSSProperties | undefined = isAnimating
    ? buildAnimationStyle(animDirection, seedVariant, seedSpeed, themeTransitions)
    : undefined;

  // Build reveal animation style for REVEALING phase
  const revealStyle: React.CSSProperties | undefined = showReveal
    ? buildRevealStyle(seedVariant, seedSpeed, themeTransitions)
    : undefined;

  // Ghost Container style: fix one axis when in hybrid mode
  const ghostStyle: React.CSSProperties = {
    visibility: 'hidden',
    width: parsed.width !== null ? `${parsed.width}px` : 'max-content',
    height: parsed.height !== null ? `${parsed.height}px` : 'max-content',
  };

  return (
    <div
      className={cn(
        "flex flex-col w-screen h-screen bg-transparent min-h-0",
        phaseClass(state.phase),
        className,
      )}
      data-projection-phase={state.phase}
    >
      {/* Seed Capsule: visible pre-loader during SEEDING phase */}
      {showSeed && (
        <div className="flex-1 w-full h-full flex items-center justify-center">
          <Seed
            variant={seedVariant}
            customLabels={seedLabels}
            tickMs={DECODE_TICK_MS[seedSpeed] ?? DECODE_TICK_MS.normal}
            onDecodeComplete={handleDecodeComplete}
          />
        </div>
      )}

      {/* Ghost Container: invisible, measures natural content size */}
      {showGhost && (
        <div
          ref={ghostRef}
          className="absolute top-0 left-0 pointer-events-none"
          style={ghostStyle}
        >
          <GhostErrorBoundary onError={handleGhostError}>
            <ProjectionSizingProvider mode="intrinsic">
              {children}
            </ProjectionSizingProvider>
          </GhostErrorBoundary>
        </div>
      )}

      {/* Real content: shown after measurement + SHAPING, with reveal/enter/exit animation */}
      {showContent && (
        <div
          ref={showReveal ? revealRef : undefined}
          className={cn(
            "flex flex-col flex-1 w-full h-full min-h-0",
            showReveal && "eidou-reveal-anim",
          )}
          style={showReveal ? revealStyle : undefined}
        >
          <div
            ref={contentRef}
            className="flex flex-col w-full h-full min-h-0 projection-content"
            style={contentStyle}
          >
            <ProjectionSizingProvider mode="fixed">
              {children}
            </ProjectionSizingProvider>
          </div>
        </div>
      )}

      {/* Error state: render nothing visible, state machine is in VOID with error */}
      {state.error && import.meta.env.DEV && (
        <div className="absolute inset-0 flex items-center justify-center text-destructive font-mono text-xs p-4">
          <span>GHOST_RENDER_FAILED: {state.error}</span>
        </div>
      )}
    </div>
  );
};
