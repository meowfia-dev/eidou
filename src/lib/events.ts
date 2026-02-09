import { invoke } from '@tauri-apps/api/core';

export interface SubmitActionAck {
  accepted: boolean;
  reason?: string;
}

/**
 * Emits a standardized user event to the backend and waits for acknowledgment.
 * 
 * @param action The action identifier string.
 * @param payload The data payload for the action.
 * @returns A promise resolving to the acknowledgment result.
 */
export async function emitUserEventWithAck(action: string, payload: Record<string, unknown> = {}): Promise<SubmitActionAck> {
  try {
    return await invoke<SubmitActionAck>('submit_action', {
      payload: {
        action,
        payload,
      },
    });
  } catch (error) {
    console.error(`Failed to emit user event '${action}':`, error);
    // Return a synthesized failure ack
    return { accepted: false, reason: String(error) };
  }
}

/**
 * Emits a standardized user event to the backend.
 * 
 * Wraps the payload in the expected structure:
 * {
 *   payload: {
 *     action: string,
 *     payload: Record<string, unknown>
 *   }
 * }
 * 
 * @param action The action identifier string.
 * @param payload The data payload for the action.
 */
export async function emitUserEvent(action: string, payload: Record<string, unknown> = {}): Promise<void> {
  const ack = await emitUserEventWithAck(action, payload);
  if (!ack.accepted) {
    console.warn(`User event '${action}' was not accepted: ${ack.reason || 'unknown reason'}`);
  }
}
