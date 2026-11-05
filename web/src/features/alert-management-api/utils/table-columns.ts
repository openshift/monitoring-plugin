export function parseTableColumns<K extends string>(
  value: string | null,
  definitions: ReadonlyArray<{ key: K }>,
  defaults: K[],
  required: readonly K[],
): K[] {
  try {
    const parsed: unknown = JSON.parse(value ?? 'null');
    if (
      Array.isArray(parsed) &&
      required.every((key) => parsed.includes(key)) &&
      parsed.every((key): key is K => definitions.some((definition) => definition.key === key))
    ) {
      return [...new Set(parsed)];
    }
  } catch {
    return defaults;
  }
  return defaults;
}
