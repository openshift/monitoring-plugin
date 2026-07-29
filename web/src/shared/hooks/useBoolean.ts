import { useCallback, useState } from 'react';

export const useBoolean = (
  initialValue: boolean,
): [boolean, () => void, () => void, () => void] => {
  const [value, setValue] = useState(initialValue);
  const toggle = useCallback(() => setValue((v) => !v), []);
  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);
  return [value, toggle, setTrue, setFalse];
};
