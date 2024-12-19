// Use a key for the "legacy dashboards" namespaces option that would be an
// invalid namespace name to avoid a potential clash
export const LEGACY_DASHBOARDS_KEY = '#ALL_NS#';

export const alphanumericCompare = (a: string, b: string): number => {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
};

export const deseralizeData = (data: string | null) => {
  if (typeof data !== 'string') {
    return data;
  }
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

// Common shortcuts than span pages.
export const KEYBOARD_SHORTCUTS = Object.freeze({
  focusNamespaceDropdown: 'n',
});
