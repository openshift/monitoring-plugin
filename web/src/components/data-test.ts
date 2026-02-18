export const DataTestIDs = {
  AlertCluster: 'alert-cluster',
  AlertResourceIcon: 'alert-resource-icon',
  AlertResourceLink: 'alert-resource-link',
  AlertRulesDetailResourceLink: 'alert-rules-detail-resource-link',
  AlertNamespace: 'alert-namespace',
  AlertState: 'alert-state',
  AlertSource: 'alert-source',
  AlertingRuleArrow: 'alerting-rule-arrow',
  AlertingRuleDetailsResourceLink: 'active-alerts',
  AlertingRuleResourceIcon: 'alerting-rule-resource-icon',
  AlertingRuleResourceLink: 'alerting-rule-resource-link',
  AlertingRuleSeverityBadge: 'alerting-rule-severity-badge',
  AlertingRuleStateBadge: 'alerting-rule-state-badge',
  AlertingRuleTotalAlertsBadge: 'alerting-rule-total-alerts-badge',
  LabelSuggestion: 'suggestion-line',
  CancelButton: 'cancel-button',
  Breadcrumb: 'breadcrumb',
  DownloadCSVButton: 'download-csv-button',
  EmptyBoxBody: 'empty-box-body',
  ExpireSilenceButton: 'expire-silence-button',
  ExpireXSilencesButton: 'expire-x-silences-button',
  Expression: 'expression',
  FavoriteStarButton: 'favorite-button',
  KebabDropdownButton: 'kebab-dropdown-button',
  MastHeadHelpIcon: 'help-dropdown-toggle',
  MastHeadApplicationItem: 'application-launcher-item',
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
  NamespaceDropdownMenuLink: 'dropdown-menu-item-link',
  NameLabelDropdownOptions: 'console-select-item',
  NamespaceDropdownShowSwitch: 'showSystemSwitch',
  NamespaceDropdownTextFilter: 'dropdown-text-filter',
  PersesDashboardDropdown: 'dashboard-dropdown',
  SeverityBadgeHeader: 'resource-status',
  SeverityBadge: 'severity-badge',
  SilenceAlertDropdownItem: 'silence-alert-dropdown-item',
  SilenceButton: 'silence-button',
  CreateSilenceButton: 'create-silence-btn',
  SilenceActionDropdown: 'silence-actions-toggle',
  SilenceKebabDropdown: 'silence-actions',
  SilenceDetailsResourceLink: 'firing-alerts',
  SilenceEditDropdownItem: 'silence-edit-dropdown-item',
  SilenceExpireDropdownItem: 'silence-expire-dropdown-item',
  SilenceRecreateDropdownItem: 'silence-recreate-dropdown-item',
  SilenceResourceIcon: 'silence-resource-icon',
  SilenceResourceLink: 'silence-resource-link',
  SilencesPageFormTestIDs: {
    AddLabel: 'add-label',
    AlertLabelsDescription: 'alert-labels-description',
    Comment: 'silence-comment',
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
    StartImmediately: 'silence-start-immediately',
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
    ChartBar: 'alerts-chart-bar',
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
  AlertResourceLink: 'alert-resource-link',
  ApplicationLauncher: 'application-launcher',
  ItemFilter: 'item-filter',
  KebabButton: 'kebab-button',
  NameLabelDropdown: 'dropdown-button',
  NameLabelDropdownOptions: 'dropdown-menu',
  NamespaceBarDropdown: 'namespace-bar-dropdown',
  PersesDashboardSection: 'dashboard',
  SelectAllSilencesCheckbox: 'select-all-silences-checkbox',
  SilenceResourceLink: 'silence-resource-link',
};

export const IDs = {
  ChartAxis0ChartLabel: 'chart-axis-0-ChartLabel', //id^=IDs.ChartAxis0ChartLabel AxisX
  ChartAxis1ChartLabel: 'chart-axis-1-ChartLabel', //id^=IDs.ChartAxis1ChartLabel AxisY
  persesDashboardCount: 'options-menu-top-pagination',
  persesDashboardDownloadButton: 'download-dashboard-button',
};

export const Classes = {
  AlertingRuleDetailsResourceIcon:
    '.co-m-resource-icon.co-m-resource-alertrule.co-m-resource-icon--lg',
  AlertingRuleResourceIcon: '.co-m-resource-icon.co-m-resource-alertrule',
  AlertingRuleResourceLink: '.co-resource-item__resource-name',
  AlertDetailsAlertResourceIcon: '.co-m-resource-icon.co-m-resource-alert.co-m-resource-icon--lg',
  AlertResourceIcon: '.co-m-resource-icon.co-m-resource-alert',
  AlertRulesDetailResourceIcon: '.co-m-resource-icon.co-m-resource-alertrule',
  DownloadCSVButton: '.pf-v5-c-button.pf-m-primary.co-virtualized-table--export-csv-button',
  ExpandedRow: 'button[class="pf-v6-c-button pf-m-plain pf-m-expanded"]',
  Expression: '.pf-v5-c-code-block__code',
  ToExpandRow: 'button[class="pf-v6-c-button pf-m-plain"]',
  FilterDropdown: '.pf-v6-c-menu-toggle, .pf-v5-c-menu-toggle',
  FilterDropdownExpanded: '.pf-v6-c-menu-toggle.pf-m-expanded, .pf-v5-c-menu-toggle.pf-m-expanded',
  FilterDropdownOption: '.pf-v6-c-menu__item, .pf-v5-c-menu__item',
  GraphCardInlineInfo:
    '.pf-v6-c-alert.pf-m-inline.pf-m-plain.pf-m-info, .pf-v5-c-alert.pf-m-inline.pf-m-plain.pf-m-info.query-browser__reduced-resolution',
  HorizontalNav: '.pf-v6-c-tabs__item, .co-m-horizontal-nav__menu-item',
  IndividualTag: '.pf-v6-c-label__text, .pf-v5-c-chip__text',
  LabelTag: '.pf-v6-c-label__text, .pf-v5-c-label__text',
  MainTag: '.pf-v6-c-label-group__label, .pf-v5-c-chip-group__label',
  MenuItem: '.pf-v6-c-menu__item, .pf-c-dropdown__menu-item',
  MenuItemDisabled: '.pf-v6-c-menu__list-item.pf-m-aria-disabled',
  MenuToggle: '.pf-v6-c-menu-toggle, .pf-c-dropdown__toggle',
  MetricGraph: 'query-browser__zoom',
  MetricsPagePredefinedQueriesMenuItem: '.pf-v6-c-menu__item, .pf-v5-c-select__menu-item',
  MetricsPageRows: '.pf-v6-c-data-list.pf-m-grid-md',
  MetricsPageExpandedRowIcon: '.pf-v6-c-data-list__item.pf-m-expanded', //li
  MetricsPageCollapsedRowIcon: '.pf-v6-c-data-list__item', //li
  MetricsPageQueryInput: '.cm-content.cm-lineWrapping',
  MetricsPageUngraphableResults: '.pf-v6-c-title.pf-m-md',
  MetricsPageUngraphableResultsDescription: '.pf-v6-c-empty-state__body',
  MetricsPageQueryAutocomplete: '.cm-tooltip-autocomplete.cm-tooltip.cm-tooltip-below',
  MoreLessTag: '.pf-v6-c-label-group__label, .pf-v5-c-chip-group__label',
  NamespaceDropdown: '.pf-v6-c-menu-toggle.co-namespace-dropdown__menu-toggle',
  PersesListDashboardCount: '.pf-v6-c-menu-toggle__text',
  SectionHeader: '.pf-v6-c-title.pf-m-h2, .co-section-heading',
  SuggestionLine: '.co-suggestion-line',
  TableHeaderColumn: '.pf-v6-c-table__button, .pf-c-table__button',
  SilenceAlertTitle: '.pf-v6-c-alert__title, .pf-v5-c-alert__title',
  SilenceAlertDescription: '.pf-v6-c-alert__description, .pf-v5-c-alert__description',
  SilenceAlertHelpTextParagraph: '.co-help-text.monitoring-silence-alert__paragraph',
  SilenceCommentWithoutError:
    '.pf-v6-c-form-control.pf-m-textarea.pf-m-resize-both, .pf-v5-c-form-control.pf-m-resize-both',
  SilenceCommentWithError: '.pf-v6-c-form-control.pf-m-textarea.pf-m-resize-both.pf-m-error',
  SilenceCreatorWithError: '.pf-v6-c-form-control.pf-m-error',
  SilenceHelpText: '.pf-v6-c-helper-text__item-text, .pf-v5-c-helper-text__item-text',
  SilenceKebabDropdown: '.pf-v6-c-menu-toggle.pf-m-plain, .pf-v5-c-dropdown__toggle.pf-m-plain',
  SilenceLabelRow: '.pf-v6-l-grid.pf-m-all-12-col-on-sm.pf-m-all-4-col-on-md.pf-m-gutter, .row',
  SilenceState: '.pf-v6-l-stack__item, .co-break-word',
  SilenceResourceIcon: '.co-m-resource-icon.co-m-resource-silence',
};

export const persesAriaLabels = {
  TimeRangeDropdown: 'Select time range. Currently set to [object Object]',
  RefreshButton: 'Refresh',
  RefreshIntervalDropdown: 'Select refresh interval. Currently set to 0s',
  ZoomInButton: 'Zoom in',
  ZoomOutButton: 'Zoom out',
  ViewJSONButton: 'View JSON',
};

//data-testid from MUI components
export const persesMUIDataTestIDs = {
  variableDropdown: 'variable',
  panelGroupHeader: 'panel-group-header',
  panelHeader: 'panel',
};

export const persesDashboardDataTestIDs = {
  editDashboardButtonToolbar: 'edit-dashboard-button-toolbar',
  cancelButtonToolbar: 'cancel-button-toolbar',
};

export const listPersesDashboardsDataTestIDs = {
  PersesBreadcrumbDashboardItem: 'perses-dashboards-breadcrumb-dashboard-item',
  PersesBreadcrumbDashboardNameItem: 'perses-dashboards-breadcrumb-dashboard-name-item',
  NameFilter: 'name-filter',
  ProjectFilter: 'project-filter',
  EmptyStateTitle: 'empty-state-title',
  EmptyStateBody: 'empty-state-body',
  ClearAllFiltersButton: 'clear-all-filters-button',
  DashboardLinkPrefix: 'perseslistpage-',
};

export const listPersesDashboardsOUIAIDs = {
  PageHeaderSubtitle: 'PageHeader-subtitle',
  PersesBreadcrumb: 'perses-dashboards-breadcrumb',
  PersesDashListDataViewTable: 'PersesDashList-DataViewTable',
  persesListDataViewHeaderClearAllFiltersButton: 'PersesDashList-DataViewHeader-clear-all-filters',
  persesListDataViewFilters: 'DataViewFilters',
  persesListDataViewHeaderSortButton: 'PersesDashList-DataViewTable-th',
  persesListDataViewTableDashboardNameTD: 'PersesDashList-DataViewTable-td-',
};
