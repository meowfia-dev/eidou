/**
 * ProjectionPhase State Machine
 *
 * Defines the lifecycle phases for widget materialization (RFC-004).
 * Phase transitions are enforced by the reducer -- invalid transitions
 * are silently ignored and logged in dev mode.
 *
 * @see /docs/rfc/004-materialization-protocol.md Section 3 (Lifecycle)
 */

// -- Phase ------------------------------------------------------------------

export type ProjectionPhase =
  | 'VOID'
  | 'SEEDING'
  | 'MOUNTING'
  | 'SHAPING'
  | 'REVEALING'
  | 'ENTERING'
  | 'IDLE'
  | 'EXITING';

// -- Actions ----------------------------------------------------------------

export type ProjectionAction =
  | { type: 'START_MATERIALIZATION'; hasSeed: boolean }
  | { type: 'GHOST_RENDER_COMPLETE'; width: number; height: number }
  | { type: 'GHOST_RENDER_FAILED'; error: string }
  | { type: 'RESIZE_CONFIRMED' }
  | { type: 'SEED_MINIMUM_ELAPSED' }
  | { type: 'SEED_DECODE_COMPLETE' }
  | { type: 'REVEAL_ANIMATION_COMPLETE' }
  | { type: 'ENTER_ANIMATION_COMPLETE' }
  | { type: 'CLOSE_REQUESTED' }
  | { type: 'EXIT_ANIMATION_COMPLETE' }
  | { type: 'RESET' };

// -- State ------------------------------------------------------------------

export interface ProjectionState {
  phase: ProjectionPhase;
  /** Measured content dimensions from Ghost Container (set during MOUNTING). */
  measuredSize: { width: number; height: number } | null;
  /** Whether the Seed minimum display time has elapsed. */
  seedElapsed: boolean;
  /** Whether the decode text animation has completed (+ hold timer). */
  decodeComplete: boolean;
  /** Error captured during ghost render. */
  error: string | null;
}

export const INITIAL_STATE: ProjectionState = {
  phase: 'VOID',
  measuredSize: null,
  seedElapsed: false,
  decodeComplete: false,
  error: null,
};

// -- Valid transition map ---------------------------------------------------

const VALID_TRANSITIONS: Record<ProjectionPhase, ProjectionPhase[]> = {
  VOID:     ['SEEDING', 'MOUNTING'],
  SEEDING:  ['MOUNTING', 'SHAPING', 'VOID'],
  MOUNTING: ['SHAPING', 'VOID'],
  SHAPING:   ['REVEALING', 'VOID'],
  REVEALING: ['ENTERING', 'VOID'],
  ENTERING:  ['IDLE', 'VOID'],
  IDLE:     ['EXITING', 'VOID'],
  EXITING:  ['VOID'],
};

function canTransition(from: ProjectionPhase, to: ProjectionPhase): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

// -- Reducer ----------------------------------------------------------------

export function projectionReducer(
  state: ProjectionState,
  action: ProjectionAction,
): ProjectionState {
  switch (action.type) {
    case 'START_MATERIALIZATION': {
      const next = action.hasSeed ? 'SEEDING' : 'MOUNTING';
      if (!canTransition(state.phase, next)) {
        if (import.meta.env.DEV) {
          console.warn(`[Projection] Invalid transition: ${state.phase} -> ${next}`);
        }
        return state;
      }
      return {
        ...INITIAL_STATE,
        phase: next,
      };
    }

    case 'SEED_MINIMUM_ELAPSED': {
      // Mark seed time elapsed; advance to SHAPING only when ALL conditions met:
      // measuredSize + seedElapsed + decodeComplete (triple gate).
      if (state.phase !== 'SEEDING') return state;
      const next: ProjectionState = { ...state, seedElapsed: true };
      if (next.measuredSize && next.decodeComplete) {
        return { ...next, phase: 'SHAPING' };
      }
      return next;
    }

    case 'SEED_DECODE_COMPLETE': {
      // Decode animation finished + hold timer elapsed.
      // Advance to SHAPING only when ALL conditions met.
      if (state.phase !== 'SEEDING') return state;
      const next: ProjectionState = { ...state, decodeComplete: true };
      if (next.measuredSize && next.seedElapsed) {
        return { ...next, phase: 'SHAPING' };
      }
      return next;
    }

    case 'GHOST_RENDER_COMPLETE': {
      // During SEEDING: measurement done concurrently; store dimensions.
      // During MOUNTING: measurement done; transition to SHAPING.
      if (state.phase === 'SEEDING') {
        const next: ProjectionState = {
          ...state,
          measuredSize: { width: action.width, height: action.height },
        };
        if (next.seedElapsed && next.decodeComplete) {
          return { ...next, phase: 'SHAPING' };
        }
        return next;
      }
      if (state.phase === 'MOUNTING') {
        return {
          ...state,
          phase: 'SHAPING',
          measuredSize: { width: action.width, height: action.height },
        };
      }
      return state;
    }

    case 'GHOST_RENDER_FAILED': {
      // Abort materialization on render error.
      return {
        ...INITIAL_STATE,
        error: action.error,
      };
    }

    case 'RESIZE_CONFIRMED': {
      if (state.phase !== 'SHAPING') return state;
      return { ...state, phase: 'REVEALING' };
    }

    case 'REVEAL_ANIMATION_COMPLETE': {
      if (state.phase !== 'REVEALING') return state;
      return { ...state, phase: 'ENTERING' };
    }

    case 'ENTER_ANIMATION_COMPLETE': {
      if (state.phase !== 'ENTERING') return state;
      return { ...state, phase: 'IDLE' };
    }

    case 'CLOSE_REQUESTED': {
      if (!canTransition(state.phase, 'EXITING')) {
        // If not in a phase that supports graceful exit, force to VOID.
        return INITIAL_STATE;
      }
      return { ...state, phase: 'EXITING' };
    }

    case 'EXIT_ANIMATION_COMPLETE': {
      if (state.phase !== 'EXITING') return state;
      return INITIAL_STATE;
    }

    case 'RESET': {
      return INITIAL_STATE;
    }

    default:
      return state;
  }
}
