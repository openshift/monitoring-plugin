import { Ref, useCallback, useEffect, useRef, useState } from 'react';

// SDK: use from SDK when it becomes available
export const useRefWidth = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>();

  const setRef = useCallback((e: HTMLDivElement) => {
    const newWidth = e?.clientWidth;
    if (newWidth && ref.current?.clientWidth !== newWidth) {
      setWidth(e.clientWidth);
    }
    ref.current = e;
  }, []);

  useEffect(() => {
    const handleResize = () => setWidth(ref.current?.clientWidth);
    window.addEventListener('resize', handleResize);
    window.addEventListener('sidebar_toggle', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('sidebar_toggle', handleResize);
    };
  }, []);

  // eslint-disable-next-line react-hooks/refs
  const clientWidth = ref.current?.clientWidth;

  useEffect(() => {
    if (width !== clientWidth) {
      setWidth(clientWidth);
    }
    // eslint-disable-next-line react-hooks/refs
  }, [clientWidth, width]);

  return [setRef, width] as [Ref<HTMLDivElement>, number];
};
