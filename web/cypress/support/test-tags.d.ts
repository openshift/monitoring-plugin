type BasicTag = '@flaky' | '@xfail' | '@slow';

type HighLevelComponentTag =
  | '@coo'
  | '@virtualization'
  | '@ols'
  | '@acm-alerting'
  | '@alerting'
  | '@legacy-dashboards'
  | '@metrics'
  | '@targets'
  | '@perses-dashboards'
  | '@cluster-health-analyzer';

type SpecificFeatureTag = `@${string}-${string}`;

type JiraTag = `@JIRA-${string}`;

type AllowedTag = BasicTag | HighLevelComponentTag | SpecificFeatureTag | JiraTag;
type TestTags = AllowedTag | AllowedTag[];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare namespace Cypress {
  interface SuiteConfigOverrides {
    tags?: TestTags;
  }
  interface TestConfigOverrides {
    tags?: TestTags;
  }
}

export {};
