type BasicTag = '@smoke' | '@demo' | '@flaky' | '@xfail' | '@slow';

type HighLevelComponentTag = '@monitoring' | '@incidents' | '@coo' | '@virtualization' | '@alerts' | '@metrics' | '@dashboards';

type SpecificFeatureTag = `@${string}-${string}`;

type JiraTag = `@JIRA-${string}`;

type AllowedTag = BasicTag | HighLevelComponentTag | SpecificFeatureTag | JiraTag;
type TestTags = AllowedTag | AllowedTag[];

declare namespace Cypress {
  interface SuiteConfigOverrides {
    tags?: TestTags;
  }
  interface TestConfigOverrides {
    tags?: TestTags;
  }
}

export {};
