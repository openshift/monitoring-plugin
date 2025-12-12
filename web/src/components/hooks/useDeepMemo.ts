import { isEqual } from 'lodash-es';
import { useMemo, useRef } from 'react';

// https://github.com/GoodDollar/useDeepMemo/blob/master/src/useDeepMemo.ts
const useDeepCompareMemoize = (value: any) => {
  const ref = useRef([]);

  if (!isEqual(value, ref.current)) {
    ref.current = value;
  }

  return ref.current;
};

export const useDeepMemo = <T>(factory: () => T, dependencies: any): T => {
  /* eslint-disable react-hooks/exhaustive-deps */
  return useMemo(factory, useDeepCompareMemoize(dependencies));
};
