export const MODIFIER_TAGS = ['@flaky', '@xfail', '@slow'] as const;

export const INFRASTRUCTURE_TAGS = ['@coo', '@virtualization', '@ols', '@acm'] as const;

export const FEATURE_TAGS = [
  '@alerting',
  '@legacy-dashboards',
  '@metrics',
  '@targets',
  '@perses-dashboards',
  '@cluster-health-analyzer',
] as const;

export type ModifierTag = (typeof MODIFIER_TAGS)[number];

export type InfrastructureTag = (typeof INFRASTRUCTURE_TAGS)[number];

export type FeatureTag = (typeof FEATURE_TAGS)[number];

export type SpecificFeatureTag = `@${string}-${string}`;

export type AllowedTag = ModifierTag | InfrastructureTag | FeatureTag | SpecificFeatureTag;
export type TestTags = AllowedTag | AllowedTag[];
