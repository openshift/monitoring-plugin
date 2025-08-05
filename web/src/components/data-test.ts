export const AlertsPage = {
  DownloadCSVButton: 'download-csv-button',
  AlertingRuleRow: {
    AlertingRuleArrow: 'alerting-rule-arrow',
    AlertingRuleResourceIcon: 'alerting-rule-resource-icon',
    AlertingRuleResourceLink: 'alerting-rule-resource-link',
    AlertingRuleSeverityBadge: 'alerting-rule-severity-badge',
    AlertingRuleTotalAlertsBadge: 'alerting-rule-total-alerts-badge',
    AlertingRuleStateBadge: 'alerting-rule-state-badge',
  },
  AlertRow: {
    AlertResourceIcon: 'alert-resource-icon',
    AlertResourceLink: 'alert-resource-link',
    AlertSeverityBadge: 'alert-severity-badge',
    AlertNamespace: 'alert-namespace',
    AlertState: 'alert-state',
    AlertSource: 'alert-source',
    AlertCluster: 'alert-cluster',
    SilenceAlertDropdownItem: 'silence-alert-dropdown-item',
  },
};

export const AlertingRulesPage = {
  AlertingRuleRow: {
    AlertingRuleResourceIcon: 'alerting-rule-resource-icon',
    AlertingRuleResourceLink: 'alerting-rule-resource-link',
    AlertingRuleSeverityBadge: 'alerting-rule-severity-badge',
    AlertingRuleStateBadge: 'alerting-rule-state-badge',
    AlertingRuleSource: 'alerting-rule-source',
  },
};

export const AlertRulesDetailsPage = {
  Header: {
    AlertResourceIcon: 'alert-resource-icon',
    SeverityBadgeHeader: 'severity-badge-header',
    AlertingRulesBreadcrumb: 'alerting-rules-breadcrumb',
  },
  Details: {
    Name: 'name',
    Severity: 'severity-badge-details',
    Description: 'description',
    Summary: 'summary',
    Source: 'source',
    For: 'for',
    Expression: 'expression',
    Labels: 'labels',
  },
  ActiveAlerts: {
    Description: 'active-alerts',
  },
};

export const AlertingDetailsPage = {
  Header: {
    AlertResourceIcon: 'alert-resource-icon',
    SeverityBadgeHeader: 'severity-badge-header',
    AlertingBreadcrumb: 'alerting-breadcrumb',
    SilenceAlertButton: 'silence-alert-button',
  },
  Details: {
    Name: 'name',
    Severity: 'severity',
    Description: 'description',
    Summary: 'summary',
    Source: 'source',
    State: 'state',
    Labels: 'labels',
    AlertingRuleIcon: 'alerting-rule-icon',
    AlertingRuleLink: 'alerting-rule-link',
  },
};

export const SilencesPage = {
  CreateSilenceButton: 'create-silence-btn',
  ExpireXSilencesButton: 'expire-x-silences-button',
  SilencesTable: {
    SilencesTable: 'silences-table',
    SelectAllCheckbox: 'select-all-checkbox',
    SelectCheckbox: 'select-checkbox',
    SilenceResourceIcon: 'silence-resource-icon',
    SilenceResourceLink: 'silence-resource-link',
    SilenceMatchersList: 'silence-matchers-list',
    SilenceCount: 'silence-count',
    SilenceState: 'silence-state',
    SilenceCreatedBy: 'silence-created-by',
    SilenceKebabDropdown: 'silence-kebab-dropdown',
    SilenceRecreateDropdownItem: 'silence-recreate-dropdown-item',
    SilenceEditDropdownItem: 'silence-edit-dropdown-item',
    SilenceExpireDropdownItem: 'silence-expire-dropdown-item',
    Name: 'name',
    Description: 'description',
    Summary: 'summary',
    Source: 'source',
  },
  ExpireSilenceModal: {
    ExpireSilenceButton: 'expire-silence-button',
    CancelButton: 'cancel-button',
  },
};

export const CreateSilencesPage = {
  Description: 'description-header',
  SilenceFrom: 'silence-from',
  SilenceFor: 'silence-for',
  SilenceForToggle: 'silence-for-toggle',
  SilenceUntil: 'silence-until',
  StartImmediately: 'start-immediately',
  AlertLabelsDescription: 'alert-labels-description',
  LabelName: 'label-name',
  LabelValue: 'label-value',
  Regex: 'regex-checkbox',
  NegativeMatcherCheckbox: 'negative-matcher-checkbox',
  RemoveLabel: 'remove-label',
  AddLabel: 'add-label',
  Creator: 'creator',
  Comment: 'silence-comment',
  SilenceButton: 'silence-button',
  CancelButton: 'cancel-button',
};

export const SilenceDetailsPage = {
  Header: {
    SilencesBreadcrumb: 'silences-breadcrumb',
    SilenceResourceIcon: 'silence-resource-icon',
  },
  Details: {
    SilenceName: 'silence-name',
    SilenceMatchers: 'silence-matchers',
    SilenceCreatedBy: 'silence-created-by',
    SilenceState: 'silence-state',
    SilenceUpdatedAt: 'silence-updated-at',
    SilenceStartsAt: 'silence-starts-at',
    SilenceEndsAt: 'silence-ends-at',
    SilenceComment: 'silence-comment',
    SilenceFiringAlertsBadge: 'silence-firing-alerts-badge',
    SilenceFiringAlert: 'silence-firing-alert',
    SilenceFiringAlertSeverity: 'silence-firing-alert-severity',
  },
};

export const LegacyDashboardPage = {
  TimeRangeDropdown: 'time-range-dropdown',
  TimeRangeDropdownOptions: 'time-range-dropdown-options',
  PollIntervalDropdown: 'poll-interval-dropdown',
  PollIntervalDropdownOptions: 'poll-interval-dropdown-options',
  Inspect: 'inspect',
  ExportAsCsv: 'export-as-csv',
};

export const PersesDashboardPage = {
  ProjectMenuToggle: 'project-menu-toggle',
};

export const Components = {
  KebabDropdownButton: 'kebab-dropdown-button',
  DropdownPollInterval: 'dropdown-poll-interval',
  GraphUnitsDropDown: 'graph-units-dropdown',
  ResetZoomButton: 'reset-zoom-button',
  GraphTimespanDropdown: 'graph-timespan-dropdown',
  GraphTimespanInput: 'graph-timespan-input',
  StackedCheckbox: 'stacked-checkbox',
  DisconnectedCheckbox: 'disconnected-checkbox',
  TypeaheadSelect: {
    PredefinedQueriesDropdown: 'predefined-queries-dropdown',
  },
  SingleTypeaheadSelectListBox: 'single-typeahead-select-list-box',
  SingleTypeaheadTextInput: 'single-typeahead-text-input',
  SingleTypeaheadMenuToggle: 'single-typeahead-menu-toggle',
  MetricsPage: {
    HideShowGraphButton: 'hide-show-graph-button',
    ActionsDropdownButton: 'actions-dropdown-button',
    AddQueryDropdownItem: 'add-query-dropdown-item',
    ExpandCollapseAllDropdownItem: 'expand-collapse-all-dropdown-item',
    DeleteAllQueriesDropdownItem: 'delete-all-queries-dropdown-item',
    SeriesButton: 'series-button',
    ExportCsvDropdownItem: 'export-csv-dropdown-item',
    DisableEnableQueryDropdownItem: 'disable-enable-query-dropdown-item',
    HideShowAllSeriesDropdownItem: 'hide-show-all-series-dropdown-item',
    DeleteQueryDropdownItem: 'delete-query-dropdown-item',
    DuplicateQueryDropdownItem: 'duplicate-query-dropdown-item',
    YellowNoDatapointsFound: 'yellow-no-datapoints-found',
    SelectAllUnselectAllDropdownItem: 'select-all-unselect-all-dropdown-item',
    QueryTable: 'query-table',
    DisableEnableQuerySwitch: 'disable-enable-query-switch',
    ExpandCollapseAllButton: 'expand-collapse-all-button',
    NoQueryEnteredTitle: 'no-query-entered-title',
    NoQueryEntered: 'no-query-entered',
    InsertExampleQueryButton: 'insert-example-query-button',
    AddQueryButton: 'add-query-button',
    RunQueriesButton: 'run-queries-button',
  },
};
