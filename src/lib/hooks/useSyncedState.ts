import { useState, useEffect, type Dispatch, type SetStateAction, type DependencyList } from 'react';

/**
 * A hook that maintains local state which automatically syncs with a server-authoritative prop.
 * 
 * @param propValue The value from the parent/server.
 * @param dependencies Optional dependency list to trigger the sync. Defaults to [propValue].
 *                     Use this if propValue is referentially unstable (e.g. arrays/objects created in render).
 * @returns [localState, setLocalState]
 */
export function useSyncedState<T>(
  propValue: T,
  dependencies?: DependencyList
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(propValue);

  useEffect(() => {
    setState(propValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies || [propValue]);

  return [state, setState];
}
