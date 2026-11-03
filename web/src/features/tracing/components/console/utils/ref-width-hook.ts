import { Ref, useEffect, useRef, useState } from 'react';

export const useRefWidth = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>();

  useEffect(() => {
    const handleResize = () => setWidth(ref.current?.clientWidth);
    window.addEventListener('resize', handleResize);
    window.addEventListener('sidebar_toggle', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('sidebar_toggle', handleResize);
    };
  }, []);

  const clientWidth = ref.current?.clientWidth; // eslint-disable-line react-hooks/refs

  useEffect(() => {
    if (width !== clientWidth) setWidth(clientWidth); // eslint-disable-line react-hooks/set-state-in-effect
  }, [clientWidth, width]); // eslint-disable-line react-hooks/refs

  return [ref, width] as [Ref<HTMLDivElement>, number];
};
