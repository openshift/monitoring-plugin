import { useEffect, useState } from 'react';

const PF_THEME_DARK_CLASS_V6 = 'pf-v6-theme-dark';
const PF_THEME_DARK_CLASS_V5 = 'pf-v5-theme-dark';
const PF_THEME_DARK_CLASS_V4 = 'pf-theme-dark'; // legacy class name needed to support PF4

/**
 * The @openshift-console/dynamic-plugin-sdk package does not expose the
 * theme setting of the user preferences, therefore check if the root
 * <html> element has the PatternFly css class set for the dark theme.
 */
function getTheme(): 'light' | 'dark' {
  const classList = document.documentElement.classList;
  if (
    classList.contains(PF_THEME_DARK_CLASS_V4) ||
    classList.contains(PF_THEME_DARK_CLASS_V5) ||
    classList.contains(PF_THEME_DARK_CLASS_V6)
  ) {
    return 'dark';
  }
  return 'light';
}

/**
 * In case the user sets "system default" theme in the user preferences,
 * update the theme if the system theme changes.
 */
export function usePatternFlyTheme() {
  //
  const [theme, setTheme] = useState(getTheme());

  useEffect(() => {
    const reloadTheme = () => setTheme(getTheme());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    mq.addEventListener('change', reloadTheme);
    return () => mq.removeEventListener('change', reloadTheme);
  }, [setTheme]);

  return { theme };
}
