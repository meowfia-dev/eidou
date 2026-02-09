/**
 * Holographic Seed -- Pre-loader Capsule (RFC-004 Section 6)
 *
 * A lightweight, zero-dependency capsule that appears instantly while
 * the real EUIP content is being Shadow Rendered in the background.
 *
 * Visual elements:
 *   - Frame: 200x56px capsule with 4-corner L-brackets
 *   - Label: Scramble/decode text effect (random chars -> final string)
 *   - Glow: Pulsing neon border glow
 *   - Scan: Horizontal sweep line
 *
 * Performance budget: <2KB total, sub-50ms first paint.
 * Uses CSS-only animations except for the decode text JS interval.
 *
 * @see /docs/rfc/004-materialization-protocol.md Section 6
 */

import { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Label Pools (RFC-004 Section 6.3)
// ---------------------------------------------------------------------------

const LABEL_POOLS: Record<string, readonly string[]> = {
  default:  ['PROCESSING', 'INITIALIZING', 'BOOTING_SEQUENCE'],
  tactical: ['LINK_ESTABLISHED', 'CALIBRATING_SENSORS', 'SYNC_COMPLETE'],
  glitch:   ['DECRYPTING', 'BYPASSING_FIREWALL', 'INJECTING_PAYLOAD'],
  stealth:  ['_'],
  alert:    ['ALERT', 'WARNING', 'THREAT_DETECTED'],
  success:  ['COMPLETE', 'MISSION_ACCOMPLISHED', 'TARGET_ACQUIRED'],
};

/** Characters used for the scramble/decode effect. */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&';

/** Pick a random label from the variant's pool, with optional custom override. */
function pickLabel(variant: string, customLabels?: string[]): string {
  const pool = (customLabels && customLabels.length > 0)
    ? customLabels
    : (LABEL_POOLS[variant] ?? LABEL_POOLS.default);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Pick a random glyph for scramble effect. */
function randomGlyph(): string {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}

// ---------------------------------------------------------------------------
// Decode Text Hook
// ---------------------------------------------------------------------------

/**
 * Scramble-decode effect: cycles through random glyphs before resolving
 * to the final character, left to right. Hybrid resolve logic:
 *   - 25% random chance each tick, OR
 *   - guaranteed after 6 ticks without progress (ceiling)
 * Fires onComplete callback once all characters are resolved.
 */
function useDecodeText(
  target: string,
  tickMs = 50,
  onComplete?: () => void,
): string {
  const [display, setDisplay] = useState('');
  const resolvedCount = useRef(0);
  const ticksSinceResolve = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    // Stealth variant: just show blinking cursor, no scramble
    if (target === '_') {
      setDisplay('_');
      onCompleteRef.current?.();
      return;
    }

    resolvedCount.current = 0;
    ticksSinceResolve.current = 0;
    setDisplay('');

    const interval = setInterval(() => {
      const resolved = resolvedCount.current;

      if (resolved >= target.length) {
        clearInterval(interval);
        setDisplay(target);
        onCompleteRef.current?.();
        return;
      }

      // Build the display string:
      // - Characters before `resolved`: final characters
      // - Character at `resolved`: random glyph (scrambling)
      // - Characters after `resolved`: not shown yet (empty)
      let text = target.slice(0, resolved);
      text += randomGlyph();
      // Optionally show 1-2 trailing scramble chars for depth
      const trailLen = Math.min(2, target.length - resolved - 1);
      for (let i = 0; i < trailLen; i++) {
        text += randomGlyph();
      }

      setDisplay(text);

      ticksSinceResolve.current += 1;

      // Hybrid resolve: probability + ceiling guarantee
      if (Math.random() < 0.25 || ticksSinceResolve.current >= 6) {
        resolvedCount.current += 1;
        ticksSinceResolve.current = 0;
      }
    }, tickMs);

    return () => clearInterval(interval);
  }, [target, tickMs]);

  return display;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface SeedProps {
  /** Transition variant. Determines label pool and visual style. */
  variant?: string;
  /** Custom label pool from theme transitions. Overrides built-in pool. */
  customLabels?: string[];
  /** Decode tick interval in ms. Controlled by speed preset in Projection. */
  tickMs?: number;
  /** Fired once when the decode text resolves all characters. */
  onDecodeComplete?: () => void;
}

/**
 * Holographic Seed: the "data is being decrypted" pre-loader capsule.
 *
 * Fixed size: 200x56 logical pixels.
 * Zero external data dependencies.
 */
export function Seed({ variant = 'default', customLabels, tickMs, onDecodeComplete }: SeedProps) {
  const [label] = useState(() => pickLabel(variant, customLabels));
  const decoded = useDecodeText(label, tickMs, onDecodeComplete);
  const isStealth = variant === 'stealth';

  return (
    <div className="seed-capsule" data-seed-variant={variant}>
      {/* Scan line sweep */}
      <div className="seed-scan" />

      {/* Corner brackets (4-corner L-brackets) */}
      <div className="seed-brackets" />

      {/* Label text with decode effect */}
      <div className="seed-label">
        <span className="seed-prefix">&gt; </span>
        <span className="seed-text">{decoded}</span>
        {isStealth ? (
          <span className="seed-cursor-blink" />
        ) : (
          <span className="seed-cursor">_</span>
        )}
      </div>
    </div>
  );
}
