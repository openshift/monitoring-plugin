import { useState, useEffect } from 'react';

export const useIsVisible = (ref) => {
  const [isVisible, setIsVisible] = useState(false);
  const [wasEverVisible, setWasEverVisible] = useState(false);

  useEffect(() => {
    const callback = ([entry]) => {
      setIsVisible(entry.isIntersecting);
      if (entry.isIntersecting) {
        setWasEverVisible(true);
      }
    };

    const observer = new IntersectionObserver(callback);

    if (ref?.current) {
      observer.observe(ref.current);
    }
    return () => observer.disconnect();
  }, [ref, setIsVisible, setWasEverVisible]);

  return [isVisible, wasEverVisible];
};
