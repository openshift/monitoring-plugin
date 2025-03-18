// https://github.com/fcannizzaro/react-use-cookie-watcher
import { useEffect, useState } from 'react';

// Get the cookie value by name
const getCookie = (name: string) => {
  const match = document.cookie.match(`(?:^|.*)${name}=(.+?)(?:$|[|;].*)`);
  return match ? match[1] : undefined;
};

interface UseCookieWatcherOptions<T> {
  checkEvery?: number;
  valueOnly?: T;
}

type CookieReturn<ValueOnly> = ValueOnly extends true ? string | undefined : boolean;

export function useCookieWatcher(
  name: string,
  options?: UseCookieWatcherOptions<false>,
): CookieReturn<false>;
export function useCookieWatcher(
  name: string,
  options?: UseCookieWatcherOptions<true>,
): CookieReturn<true>;
export function useCookieWatcher(
  name: string,
  options?: UseCookieWatcherOptions<boolean>,
): CookieReturn<boolean> {
  // create default options
  const hookOptions = Object.assign(
    {
      checkEvery: 250,
      valueOnly: false,
    },
    options ?? {},
  );

  // state for cookie existence
  const [cookie, setCookie] = useState(getCookie(name));

  // check for cookie existence every `checkEvery` milliseconds
  useEffect(() => {
    const interval = window.setInterval(() => setCookie(getCookie(name)), hookOptions.checkEvery);
    return () => window.clearInterval(interval);
  });

  if (options?.valueOnly === true) {
    return cookie;
  }

  return cookie !== undefined;
}

// Return the value of a cookie
export const useCookie = (name: string): string | undefined => getCookie(name);
