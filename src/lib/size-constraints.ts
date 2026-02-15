/**
 * Size Constraints for Materialization Protocol (RFC-004 Section 5)
 *
 * Provides:
 *   - SizeSpec type (all EUIP size modes)
 *   - Preset dimension lookup
 *   - Constraint clamping (85% rule, 1024px cap, anti-spaghetti)
 *   - Measurement buffer
 *
 * @see /docs/rfc/004-materialization-protocol.md Section 5
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Preset size token. Maps to fixed dimensions. */
export type SizePreset = 'sm' | 'md' | 'lg' | 'xl' | 'full';

/** Explicit or hybrid dimension value. "auto" means measure from content. */
export type DimensionValue = number | 'auto';

/** Explicit/hybrid size object. */
export interface SizeObject {
  width: DimensionValue;
  height: DimensionValue;
}

/** Ratio-based size object. */
export interface SizeRatioObject {
  ratio: string;
  width?: number;
  maxWidth?: number;
  base?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * All valid EUIP size specifications for a Projection.
 *
 * - `"auto"` -- both axes measured from content
 * - `"sm"` / `"md"` / `"lg"` -- preset fixed dimensions
 * - `{ width: N, height: N }` -- explicit fixed
 * - `{ width: N, height: "auto" }` -- hybrid (fixed width, auto height)
 * - `{ width: "auto", height: N }` -- hybrid (auto width, fixed height)
 */
export type SizeSpec = 'auto' | SizePreset | SizeObject | SizeRatioObject;

// ---------------------------------------------------------------------------
// Preset Dimensions (RFC-004 Section 5.2)
// ---------------------------------------------------------------------------

const PRESET_DIMENSIONS: Record<SizePreset, { width: number; height: number }> = {
  sm: { width: 320, height: 480 },
  md: { width: 480, height: 640 },
  lg: { width: 1024, height: 768 },
  xl: { width: 1024, height: 900 },
  full: { width: 0, height: 0 },
};

// ---------------------------------------------------------------------------
// Constraint Constants (RFC-004 Section 5.3)
// ---------------------------------------------------------------------------

const MAX_WIDTH_CAP = 1024;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 80;
const SCREEN_RATIO = 0.85;
const MEASUREMENT_BUFFER = 16;

// Anti-spaghetti guard thresholds (RFC-004 Section 5.4)
const ASPECT_RATIO_MIN = 1 / 5; // width:height < 1:5 = too tall/narrow
const ASPECT_RATIO_MAX = 5;     // width:height > 5:1 = too wide/short
const SPAGHETTI_MIN_WIDTH = 320;
const SPAGHETTI_MIN_HEIGHT = 120;
const HYBRID_CORRECTION_THRESHOLD = 1;

// ---------------------------------------------------------------------------
// Screen Info
// ---------------------------------------------------------------------------

export interface ScreenInfo {
  availWidth: number;
  availHeight: number;
}

/** Get current screen dimensions. Uses window.screen as source. */
export function getScreenInfo(): ScreenInfo {
  return {
    availWidth: window.screen.availWidth,
    availHeight: window.screen.availHeight,
  };
}

// ---------------------------------------------------------------------------
// Size Resolution
// ---------------------------------------------------------------------------

export interface ResolvedSize {
  width: number;
  height: number;
}

/**
 * Parsed representation of a SizeSpec, separating fixed and auto axes.
 * `null` means "measure from content".
 */
export interface ParsedSize {
  width: number | null;
  height: number | null;
}

function parseRatio(value: string): { width: number; height: number } | null {
  const parts = value.split(':');
  if (parts.length !== 2) return null;

  const width = Number(parts[0]);
  const height = Number(parts[1]);

  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;

  return { width, height };
}

/** Parse a SizeSpec into fixed/auto axis info. */
export function parseSizeSpec(spec: SizeSpec | undefined, screen?: ScreenInfo): ParsedSize {
  if (!spec || spec === 'auto') {
    return { width: null, height: null };
  }

  if (typeof spec === 'string') {
    if (spec === 'full') {
      if (!screen) {
        return { width: null, height: null };
      }
      return { width: screen.availWidth, height: screen.availHeight };
    }

    const preset = PRESET_DIMENSIONS[spec as SizePreset];
    if (preset) return { width: preset.width, height: preset.height };
    // Unknown string -- treat as auto
    return { width: null, height: null };
  }

  if ('ratio' in spec && typeof spec.ratio === 'string') {
    const parsedRatio = parseRatio(spec.ratio);
    if (!parsedRatio) {
      return { width: null, height: null };
    }

    const basePreset = spec.base ?? 'md';
    const baseWidth = PRESET_DIMENSIONS[basePreset].width;
    const requestedWidth = typeof spec.width === 'number' ? spec.width : baseWidth;
    const maxWidth = typeof spec.maxWidth === 'number' ? spec.maxWidth : Number.POSITIVE_INFINITY;
    const width = Math.max(MIN_WIDTH, Math.min(requestedWidth, maxWidth));
    const height = width * (parsedRatio.height / parsedRatio.width);

    return { width, height };
  }

  // Object form: { width, height }
  const objectWidth = 'width' in spec ? spec.width : undefined;
  const objectHeight = 'height' in spec ? spec.height : undefined;
  const width = objectWidth === 'auto' ? null : (typeof objectWidth === 'number' ? objectWidth : null);
  const height = objectHeight === 'auto' ? null : (typeof objectHeight === 'number' ? objectHeight : null);

  return { width, height };
}

/** Check if any axis needs measurement. */
export function needsMeasurement(parsed: ParsedSize): boolean {
  return parsed.width === null || parsed.height === null;
}

/** Check if size is fully fixed (no measurement needed). */
export function isFullyFixed(parsed: ParsedSize): boolean {
  return parsed.width !== null && parsed.height !== null;
}

/** Check if exactly one axis is auto (hybrid sizing). */
export function isHybridAutoAxis(parsed: ParsedSize): boolean {
  const autoAxisCount = Number(parsed.width === null) + Number(parsed.height === null);
  return autoAxisCount === 1;
}

/**
 * Decide whether a post-resize hybrid correction should be applied.
 *
 * Correction only applies when the auto axis needs to grow beyond a small
 * threshold. Shrinks are ignored to avoid jitter.
 */
export function shouldApplyHybridCorrection(
  current: ResolvedSize,
  corrected: ResolvedSize,
  parsed: ParsedSize,
): boolean {
  if (!isHybridAutoAxis(parsed)) return false;

  if (parsed.width === null) {
    return corrected.width > current.width + HYBRID_CORRECTION_THRESHOLD;
  }

  if (parsed.height === null) {
    return corrected.height > current.height + HYBRID_CORRECTION_THRESHOLD;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Constraint Clamping (RFC-004 Section 5.3 + 5.4)
// ---------------------------------------------------------------------------

/**
 * Apply RFC-004 size constraints to measured/explicit dimensions.
 *
 * 1. Add measurement buffer (+16px) to measured axes
 * 2. Clamp to min bounds (200x80)
 * 3. Clamp to max bounds (1024px width cap, 85% screen)
 * 4. Anti-spaghetti guard (extreme aspect ratios)
 *
 * @param measured - Raw measured or explicit dimensions
 * @param screen - Screen info for computing max bounds
 * @param wasAutoWidth - Whether width was measured (applies buffer)
 * @param wasAutoHeight - Whether height was measured (applies buffer)
 */
export function clampDimensions(
  measured: ResolvedSize,
  screen: ScreenInfo,
  wasAutoWidth: boolean,
  wasAutoHeight: boolean,
): ResolvedSize {
  let { width, height } = measured;

  // 1. Measurement buffer -- only for auto-measured axes
  if (wasAutoWidth) width += MEASUREMENT_BUFFER;
  if (wasAutoHeight) height += MEASUREMENT_BUFFER;

  // 2. Max bounds
  const maxWidth = Math.min(MAX_WIDTH_CAP, screen.availWidth * SCREEN_RATIO);
  const maxHeight = screen.availHeight * SCREEN_RATIO;

  width = Math.min(width, maxWidth);
  height = Math.min(height, maxHeight);

  // 3. Min bounds
  width = Math.max(width, MIN_WIDTH);
  height = Math.max(height, MIN_HEIGHT);

  // 4. Anti-spaghetti guard
  const ratio = width / height;
  if (ratio < ASPECT_RATIO_MIN) {
    // Too tall and narrow
    width = Math.max(width, SPAGHETTI_MIN_WIDTH);
  } else if (ratio > ASPECT_RATIO_MAX) {
    // Too wide and short
    height = Math.max(height, SPAGHETTI_MIN_HEIGHT);
  }

  return { width: Math.round(width), height: Math.round(height) };
}

/**
 * Resolve a SizeSpec + optional ghost measurement into final clamped dimensions.
 *
 * For fully fixed sizes: returns clamped fixed dimensions (no measurement needed).
 * For auto/hybrid sizes: merges measurement with fixed axis, applies constraints.
 */
export function resolveFinalSize(
  spec: SizeSpec | undefined,
  ghostMeasurement: ResolvedSize | null,
  screen: ScreenInfo,
): ResolvedSize {
  if (spec === 'full') {
    return { width: Math.round(screen.availWidth), height: Math.round(screen.availHeight) };
  }

  const parsed = parseSizeSpec(spec, screen);

  if (isFullyFixed(parsed)) {
    // Fixed size -- clamp but no measurement buffer
    return clampDimensions(
      { width: parsed.width!, height: parsed.height! },
      screen,
      false,
      false,
    );
  }

  // Need measurement for at least one axis
  if (!ghostMeasurement) {
    // No measurement available -- fall back to defaults
    // This shouldn't happen in normal flow (measurement comes before SHAPING)
    if (import.meta.env.DEV) {
      console.warn('[SizeConstraints] Ghost measurement missing for auto size, using defaults');
    }
    return clampDimensions(
      { width: parsed.width ?? 480, height: parsed.height ?? 640 },
      screen,
      parsed.width === null,
      parsed.height === null,
    );
  }

  // Merge fixed axes with measured axes
  const raw: ResolvedSize = {
    width: parsed.width ?? ghostMeasurement.width,
    height: parsed.height ?? ghostMeasurement.height,
  };

  return clampDimensions(
    raw,
    screen,
    parsed.width === null,
    parsed.height === null,
  );
}
