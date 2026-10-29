import { Dispatch, useCallback, useEffect, useRef } from 'react';

const parseValue = <T,>(value: string | null): T | null => {
  if (value) {
    try {
      const json = JSON.parse(value);
      return json as T;
      // eslint-disable-next-line no-empty
    } catch {}
  }

  return null;
};

export const useLocalStorage = <T,>(key: string): [T | null, Dispatch<T>] => {
  const value = useRef<T | null>(parseValue(window.localStorage.getItem(key)));

  const callback = useCallback(
    (event: StorageEvent) => {
      if (event.key === key) {
        value.current = parseValue(event.newValue);
      }
    },
    [key],
  );

  useEffect(() => {
    window.addEventListener('storage', callback);
    return () => {
      window.removeEventListener('storage', callback);
    };
  }, [callback]);

  const updateValue = useCallback(
    (val: T) => window.localStorage.setItem(key, JSON.stringify(val)),
    [key],
  );
  // eslint-disable-next-line react-hooks/refs
  return [value.current, updateValue];
};
