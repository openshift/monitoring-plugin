export type Perspective = 'admin' | 'dev' | 'acm' | 'virtualization-perspective';

export const PerspectiveName = {
  Admin: 'admin',
  Developer: 'dev',
  ACM: 'acm',
  Virtualization: 'virtualization-perspective',
} as const satisfies Record<string, Perspective>;

export type CustomerPerspective =
  | 'Core platform'
  | 'Administrator'
  | 'Developer'
  | 'Fleet management'
  | 'Fleet virtualization'
  | 'Virtualization';

export const CustomerPerspectiveName = {
  CorePlatform: 'Core platform',
  Administrator: 'Administrator',
  Developer: 'Developer',
  FleetManagement: 'Fleet management',
  FleetVirtualization: 'Fleet virtualization',
  Virtualization: 'Virtualization',
} as const satisfies Record<string, CustomerPerspective>;

export type UrlRoot = 'monitoring' | 'dev-monitoring' | 'multicloud/monitoring' | 'virt-monitoring';

export const UrlRootName = {
  [PerspectiveName.Admin]: 'monitoring',
  [PerspectiveName.Developer]: 'dev-monitoring',
  [PerspectiveName.Virtualization]: 'virt-monitoring',
  [PerspectiveName.ACM]: 'multicloud/monitoring',
} as const satisfies Record<Perspective, UrlRoot>;
