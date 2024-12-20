// Use a key for the "legacy dashboards" namespaces option that would be an
// invalid namespace name to avoid a potential clash
export const LEGACY_DASHBOARDS_KEY = '#LEGACY#';

export const alphanumericCompare = (a: string, b: string): number => {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
};

// Common shortcuts than span pages.
export const KEYBOARD_SHORTCUTS = Object.freeze({
  focusNamespaceDropdown: 'n',
});
