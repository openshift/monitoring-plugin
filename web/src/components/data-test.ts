export const DataTestIDs = {
  AlertCluster: 'alert-cluster',
  AlertResourceIcon: 'alert-resource-icon',
  AlertResourceLink: 'alert-resource-link',
  AlertNamespace: 'alert-namespace',
  AlertState: 'alert-state',
  AlertSource: 'alert-source',
  AlertingRuleArrow: 'alerting-rule-arrow',
  AlertingRuleResourceIcon: 'alerting-rule-resource-icon',
  AlertingRuleResourceLink: 'alerting-rule-resource-link',
  AlertingRuleSeverityBadge: 'alerting-rule-severity-badge',
  AlertingRuleStateBadge: 'alerting-rule-state-badge',
  AlertingRuleTotalAlertsBadge: 'alerting-rule-total-alerts-badge',
  CancelButton: 'cancel-button',
  Breadcrumb: 'breadcrumb',
  DownloadCSVButton: 'download-csv-button',
  EmptyBoxBody: 'empty-box-body',
  ExpireSilenceButton: 'expire-silence-button',
  ExpireXSilencesButton: 'expire-x-silences-button',
  Expression: 'expression',
  KebabDropdownButton: 'kebab-dropdown-button',
  MetricGraph: 'metric-graph',
  MetricGraphNoDatapointsFound: 'datapoints-msg',
  MetricGraphTimespanDropdown: 'graph-timespan-dropdown',
  MetricGraphTimespanInput: 'graph-timespan-input',
  MetricDisconnectedCheckbox: 'disconnected-checkbox',
  MetricDropdownPollInterval: 'dropdown-poll-interval',
  MetricGraphUnitsDropDown: 'graph-units-dropdown',
  MetricHideShowGraphButton: 'hide-show-graph-button',
  MetricResetZoomButton: 'reset-zoom-button',
  MetricStackedCheckbox: 'stacked-checkbox',
  MetricsPageActionsDropdownButton: 'actions-dropdown-button',
  MetricsPageAddQueryButton: 'add-query-button',
  MetricsPageAddQueryDropdownItem: 'add-query-dropdown-item',
  MetricsPageDeleteAllQueriesDropdownItem: 'delete-all-queries-dropdown-item',
  MetricsPageDeleteQueryDropdownItem: 'delete-query-dropdown-item',
  MetricsPageDisableEnableQuerySwitch: 'disable-enable-query-switch',
  MetricsPageDuplicateQueryDropdownItem: 'duplicate-query-dropdown-item',
  MetricsPageDisableEnableQueryDropdownItem: 'disable-enable-query-dropdown-item',
  MetricsPageExpandCollapseRowButton: 'expand-collapse-row-button', //div
  MetricsPageExpandCollapseAllDropdownItem: 'expand-collapse-all-dropdown-item',
  MetricsPageExportCsvDropdownItem: 'export-csv-dropdown-item',
  MetricsPageHideShowAllSeriesDropdownItem: 'hide-show-all-series-dropdown-item',
  MetricsPageInsertExampleQueryButton: 'insert-example-query-button',
  MetricsPageNoQueryEnteredTitle: 'no-query-entered-title',
  MetricsPageNoQueryEntered: 'no-query-entered',
  MetricsPageQueryTable: 'query-table',
  MetricsPageRunQueriesButton: 'run-queries-button',
  MetricsPageSelectAllUnselectAllButton: 'select-all-unselect-all-button',
  MetricsPageSeriesButton: 'series-button',
  MetricsPageYellowNoDatapointsFound: 'yellow-no-datapoints-found',
  NameInput: 'name-filter-input',
  NameLabelDropdown: 'console-select-menu-toggle',
  NameLabelDropdownOptions: 'console-select-item',
  SeverityBadgeHeader: 'severity-badge-header',
  SeverityBadge: 'severity-badge',
  SilenceAlertDropdownItem: 'silence-alert-dropdown-item',
  SilenceButton: 'silence-button',
  SilenceEditDropdownItem: 'silence-edit-dropdown-item',
  SilenceExpireDropdownItem: 'silence-expire-dropdown-item',
  SilenceRecreateDropdownItem: 'silence-recreate-dropdown-item',
  SilenceResourceIcon: 'silence-resource-icon',
  SilenceResourceLink: 'silence-resource-link',
  SilencesPageFormTestIDs: {
    AddLabel: 'add-label',
    AlertLabelsDescription: 'alert-labels-description',
    Comment: 'comment',
    Creator: 'creator',
    Description: 'description-header',
    LabelName: 'label-name',
    LabelValue: 'label-value',
    NegativeMatcherCheckbox: 'negative-matcher-checkbox',
    Regex: 'regex-checkbox',
    RemoveLabel: 'remove-label',
    SilenceFrom: 'silence-from',
    SilenceFor: 'silence-for',
    SilenceForToggle: 'silence-for-toggle',
    SilenceUntil: 'silence-until',
    StartImmediately: 'start-immediately',
  },
  TypeaheadSelectInput: 'query-select-typeahead-input',
  Table: 'OUIA-Generated-Table', //table ouiaid - ID to be used with byOUIAID(DataTestIDs.Table)
  MetricsGraphAlertDanger: 'OUIA-Generated-Alert-danger', //ID to be used with byOUIAID(DataTestIDs.MetricsGraphAlertDanger)

  // Incidents Page Test IDs
  IncidentsPage: {
    Toolbar: 'incidents-toolbar',
    DaysSelect: 'incidents-days-select',
    DaysSelectToggle: 'incidents-days-select-toggle',
    DaysSelectList: 'incidents-days-select-list',
    DaysSelectOption: 'incidents-days-select-option',
    FiltersSelect: 'incidents-filters-select',
    FiltersSelectToggle: 'incidents-filters-select-toggle',
    FiltersSelectList: 'incidents-filters-select-list',
    FiltersSelectOption: 'incidents-filters-select-option',
    FilterChip: 'incidents-filter-chip',
    FilterChipRemove: 'incidents-filter-chip-remove',
    ClearAllFiltersButton: 'incidents-clear-all-filters',
    ToggleChartsButton: 'incidents-toggle-charts',
    LoadingSpinner: 'incidents-loading-spinner',
  },

  // Incidents Chart Test IDs
  IncidentsChart: {
    Card: 'incidents-chart-card',
    Title: 'incidents-chart-title',
    ChartContainer: 'incidents-chart-container',
    LoadingSpinner: 'incidents-chart-loading-spinner',
    ChartBars: 'incidents-chart-bars',
    ChartBar: 'incidents-chart-bar',
  },

  // Alerts Chart Test IDs
  AlertsChart: {
    Card: 'alerts-chart-card',
    Title: 'alerts-chart-title',
    EmptyState: 'alerts-chart-empty-state',
    ChartContainer: 'alerts-chart-container',
  },

  // Incidents Table Test IDs
  IncidentsTable: {
    Table: 'incidents-alerts-table',
    ExpandButton: 'incidents-table-expand-button',
    Row: 'incidents-table-row',
    ComponentCell: 'incidents-table-component-cell',
    SeverityCell: 'incidents-table-severity-cell',
    StateCell: 'incidents-table-state-cell',
  },

  // Incidents Details Row Table Test IDs
  IncidentsDetailsTable: {
    Table: 'incidents-details-table',
    LoadingSpinner: 'incidents-details-loading-spinner',
    Row: 'incidents-details-row',
    AlertRuleCell: 'incidents-details-alert-rule-cell',
    NamespaceCell: 'incidents-details-namespace-cell',
    SeverityCell: 'incidents-details-severity-cell',
    StateCell: 'incidents-details-state-cell',
    StartCell: 'incidents-details-start-cell',
    EndCell: 'incidents-details-end-cell',
    AlertRuleLink: 'incidents-details-alert-rule-link',
  },
};

export const LegacyDashboardPageTestIDs = {
  TimeRangeDropdown: 'time-range-dropdown', //div
  TimeRangeDropdownOptions: 'time-range-dropdown-options',
  PollIntervalDropdown: 'poll-interval-dropdown', //div
  PollIntervalDropdownOptions: 'poll-interval-dropdown-options',
  Inspect: 'inspect',
  ExportAsCsv: 'export-as-csv',
  DashboardDropdown: 'dashboard-dropdown', //div
  DashboardTimeRangeDropdownMenu: 'monitoring-time-range-dropdown', //div using get('#'+LegacyDashboardPageTestIDs.DashboardTimeRangeDropdownMenu)
  DashboardRefreshIntervalDropdownMenu: 'refresh-interval-dropdown', //div using get('#'+LegacyDashboardPageTestIDs.DashboardRefreshIntervalDropdownMenu)
  Graph: 'graph',
};

export const LegacyTestIDs = {
  ItemFilter: 'item-filter',
  SelectAllSilencesCheckbox: 'select-all-silences-checkbox',
};

export const IDs = {
  ChartAxis0ChartLabel: 'chart-axis-0-ChartLabel', //id^=IDs.ChartAxis0ChartLabel AxisX
  ChartAxis1ChartLabel: 'chart-axis-1-ChartLabel', //id^=IDs.ChartAxis1ChartLabel AxisY
};

export const Classes = {
  ExpandedRow: 'button[class="pf-v6-c-button pf-m-plain pf-m-expanded"]',
  ToExpandRow: 'button[class="pf-v6-c-button pf-m-plain"]',
  FilterDropdown: '.pf-v6-c-menu-toggle, .pf-v5-c-menu-toggle',
  FilterDropdownExpanded: '.pf-v6-c-menu-toggle.pf-m-expanded, .pf-v5-c-menu-toggle.pf-m-expanded',
  FilterDropdownOption: '.pf-v6-c-menu__item, .pf-c-select__menu-item',
  GraphCardInlineInfo:
    '.pf-v6-c-alert.pf-m-inline.pf-m-plain.pf-m-info, .pf-v5-c-alert.pf-m-inline.pf-m-plain.pf-m-info.query-browser__reduced-resolution',
  HorizontalNav: '.pf-v6-c-tabs__item, .co-m-horizontal-nav__menu-item',
  IndividualTag: '.pf-v6-c-label__text, .pf-v5-c-chip__text',
  LabelSuggestion: '.pf-v6-c-label__content.pf-m-clickable, .co-suggestion-line',
  LabelTag: '.pf-v6-c-label__text, .pf-v5-c-label__text',
  MainTag: '.pf-v6-c-label-group__label, .pf-v5-c-chip-group__label',
  MenuItem: '.pf-v6-c-menu__item, .pf-c-dropdown__menu-item',
  MenuItemDisabled: '.pf-v6-c-menu__list-item.pf-m-aria-disabled',
  MenuToggle: '.pf-v6-c-menu-toggle, .pf-c-dropdown__toggle',
  MetricsPagePredefinedQueriesMenuItem: '.pf-v6-c-menu__item, .pf-v5-c-select__menu-item',
  MetricsPageRows: '.pf-v6-c-data-list.pf-m-grid-md',
  MetricsPageExpandedRowIcon: '.pf-v6-c-data-list__item.pf-m-expanded', //li
  MetricsPageCollapsedRowIcon: '.pf-v6-c-data-list__item', //li
  MetricsPageQueryInput: '.cm-content.cm-lineWrapping',
  MetricsPageUngraphableResults: '.pf-v6-c-title.pf-m-md',
  MetricsPageUngraphableResultsDescription: '.pf-v6-c-empty-state__body',
  MetricsPageQueryAutocomplete: '.cm-tooltip-autocomplete.cm-tooltip.cm-tooltip-below',
  MoreLessTag: '.pf-v6-c-label-group__label, .pf-v5-c-chip-group__label',
  SectionHeader: '.pf-v6-c-title.pf-m-h2, .co-section-heading',
  TableHeaderColumn: '.pf-v6-c-table__button, .pf-c-table__button',
  SilenceAlertTitle: '.pf-v6-c-alert__title, .pf-v5-c-alert__title',
  SilenceAlertDescription: '.pf-v6-c-alert__description, .pf-v5-c-alert__description',
  SilenceCommentWithoutError: '.pf-v6-c-form-control.pf-m-textarea.pf-m-resize-both',
  SilenceCommentWithError: '.pf-v6-c-form-control.pf-m-textarea.pf-m-resize-both.pf-m-error',
  SilenceCreatorWithError: '.pf-v6-c-form-control.pf-m-error',
  SilenceHelpText: '.pf-v6-c-helper-text__item-text, .pf-v5-c-helper-text__item-text',
  SilenceKebabDropdown: '.pf-v6-c-menu-toggle.pf-m-plain, .pf-v5-c-dropdown__toggle.pf-m-plain',
  SilenceLabelRow: '.pf-v6-l-grid.pf-m-all-12-col-on-sm.pf-m-all-4-col-on-md.pf-m-gutter, .row',
  SilenceState: '.pf-v6-l-stack__item, .co-break-word',
};
