export const alphanumericCompare = (a: string, b: string): number => {
  const safeA = a || '';
  const safeB = b || '';

  return safeA.localeCompare(safeB, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
};

// Common shortcuts than span pages.
export const KEYBOARD_SHORTCUTS = Object.freeze({
  focusNamespaceDropdown: 'n',
});
