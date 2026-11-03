import { useEffect, useState } from 'react';

// the unversioned class name is required for PF4
const PF_THEME_DARK_CLASSES = ['pf-v6-theme-dark', 'pf-v5-theme-dark', 'pf-theme-dark'];

/**
 * The @openshift-console/dynamic-plugin-sdk package does not expose the theme setting of the user preferences,
 * therefore check if the root <html> element has the PatternFly css class set for the dark theme.
 */
function getTheme(): 'light' | 'dark' {
  const classList = document.documentElement.classList;
  for (const className of PF_THEME_DARK_CLASSES) {
    if (classList.contains(className)) {
      return 'dark';
    }
  }
  return 'light';
}

/**
 * In case the user sets "system default" theme in the user preferences, update the theme if the system theme changes.
 */
export function usePatternFlyTheme() {
  const [theme, setTheme] = useState(getTheme());

  useEffect(() => {
    const reloadTheme = () => setTheme(getTheme());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    mq.addEventListener('change', reloadTheme);
    return () => mq.removeEventListener('change', reloadTheme);
  }, [setTheme]);

  return { theme };
}
