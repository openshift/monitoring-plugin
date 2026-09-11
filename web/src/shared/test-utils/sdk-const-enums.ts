/**
 * Runtime values for the `const enum`s declared by
 * `@openshift-console/dynamic-plugin-sdk`.
 *
 * `const enum`s are inlined by the TypeScript compiler and therefore have no
 * runtime representation in the SDK's compiled `.js` files. esbuild (used by
 * Vitest) transpiles files in isolation and cannot inline them across modules,
 * so tests that mock the SDK and reference these enums at runtime must supply
 * the values themselves. Spread this into a `vi.mock` factory for the SDK.
 */
export enum AlertStates {
  Firing = 'firing',
  NotFiring = 'not-firing',
  Pending = 'pending',
  Silenced = 'silenced',
}

export enum SilenceStates {
  Active = 'active',
  Expired = 'expired',
  Pending = 'pending',
}

export enum AlertSeverity {
  Critical = 'critical',
  Info = 'info',
  None = 'none',
  Warning = 'warning',
}

export enum RuleStates {
  Firing = 'firing',
  Inactive = 'inactive',
  Pending = 'pending',
  Silenced = 'silenced',
}
