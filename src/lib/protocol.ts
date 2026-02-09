/**
 * Protocol constants for the Eidou frontend/backend interface.
 * 
 * These constants define the contract for action IDs and event types
 * used in the `emitUserEvent` flow.
 */

export const USER_ACTION_IDS = {
  INPUT_CHANGE: 'input_change',
  SELECT_CHANGE: 'select_change',
  SWITCH_CHANGE: 'switch_change',
  REMOVE_BADGE: 'remove_badge',
  LINK_NAVIGATE: 'link_navigate',
} as const;

export const SYSTEM_ACTION_IDS = {
  CLOSE: '_eidou_sys_close',
  DIAGNOSTIC: 'eidou/system/diagnostic',
} as const;
