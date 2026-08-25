export const MODIFIER_TAGS = [
  '@flaky',
  '@xfail',
  '@slow',
  '@coo',
  '@virtualization',
  '@ols',
] as const;

export const HIGH_LEVEL_COMPONENT_TAGS = [
  '@acm-alerting',
  '@alerting',
  '@legacy-dashboards',
  '@metrics',
  '@targets',
  '@perses-dashboards',
  '@cluster-health-analyzer',
] as const;

export type BasicTag = (typeof MODIFIER_TAGS)[number];

export type HighLevelComponentTag = (typeof HIGH_LEVEL_COMPONENT_TAGS)[number];

export type SpecificFeatureTag = `@${string}-${string}`;

export type AllowedTag = BasicTag | HighLevelComponentTag | SpecificFeatureTag;
export type TestTags = AllowedTag | AllowedTag[];
