// Use a key for the "all" namespaces option that would be an
// invalid namespace name to avoid a potential clash
export const ALL_NAMESPACES_KEY = '#ALL_NS#';

export const USERSETTINGS_PREFIX = 'console';

// This localStorage key predates the storage prefix.
export const NAMESPACE_USERSETTINGS_PREFIX = `${USERSETTINGS_PREFIX}.namespace`;

export const NAMESPACE_LOCAL_STORAGE_KEY = 'dropdown-storage-namespaces';

export enum FLAGS {
  CAN_LIST_NS = 'CAN_LIST_NS',
}

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
