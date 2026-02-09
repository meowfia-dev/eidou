import { useState, useEffect, useCallback, useRef } from 'react';
import { emitUserEvent } from '../events';
import { USER_ACTION_IDS } from '../protocol';

interface UseCommittedTextInputProps {
  name: string;
  value?: string;
  trigger?: 'blur' | 'change';
  debounceMs?: number;
  actionId?: string;
  /** Canonical action kind for unified payload. Always included regardless of actionId override. */
  kind?: string;
}

interface UseCommittedTextInputResult {
  localValue: string;
  setLocalValue: (value: string) => void;
  onBlurCommit: () => void;
  onEnterCommit: (e: React.KeyboardEvent) => void;
  onChange: (value: string) => void;
}

export function useCommittedTextInput({
  name,
  value = '',
  trigger = 'blur',
  debounceMs = 300,
  actionId = USER_ACTION_IDS.INPUT_CHANGE,
  kind = USER_ACTION_IDS.INPUT_CHANGE,
}: UseCommittedTextInputProps): UseCommittedTextInputResult {
  const [localValue, setLocalValue] = useState(value);
  // Store the timer in a ref so we can clear it imperatively (e.g. on blur)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Store value in ref to avoid closure staleness in commit/emit handlers
  const valueRef = useRef(value);

  // Sync from Server (Server Authority)
  useEffect(() => {
    setLocalValue(value);
    valueRef.current = value;
  }, [value]);

  const emit = useCallback((val: string) => {
    emitUserEvent(actionId, { kind, name, value: val });
  }, [actionId, kind, name]);

  const commit = useCallback(() => {
    // Clear any pending debounce timer to prevent double emit
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    emit(valueRef.current);
  }, [emit]);

  const onChange = useCallback((newValue: string) => {
    setLocalValue(newValue);
    valueRef.current = newValue;

    if (trigger === 'change') {
      // Clear existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      
      // Set new timer
      timerRef.current = setTimeout(() => {
        emit(newValue);
        timerRef.current = null;
      }, debounceMs);
    }
  }, [trigger, debounceMs, emit]);

  const onBlurCommit = useCallback(() => {
    commit();
  }, [commit]);

  const onEnterCommit = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commit();
    }
  }, [commit]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    localValue,
    setLocalValue: onChange, // Alias for convenience, or strictly just setLocalValue? Let's use onChange for the main update path
    onBlurCommit,
    onEnterCommit,
    onChange,
  };
}
