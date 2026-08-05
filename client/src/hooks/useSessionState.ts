import { Dispatch, SetStateAction, useEffect, useState } from 'react';

export function useSessionState<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = sessionStorage.getItem(key);
      return saved === null ? initialValue : JSON.parse(saved) as T;
    } catch { return initialValue; }
  });

  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Best effort. */ }
  }, [key, value]);

  return [value, setValue];
}
