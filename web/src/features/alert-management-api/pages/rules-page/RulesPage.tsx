import {
  Alert,
  Button,
  Divider,
  Flex,
  FlexItem,
  PageSection,
  Panel,
  PanelHeader,
  PanelMain,
  PanelMainBody,
  SearchInput,
  Title,
  Tooltip,
} from '@patternfly/react-core';
import { RhUiFilterFillIcon } from '@patternfly/react-icons';
import { InnerScrollContainer } from '@patternfly/react-table';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { ManageColumnsButton } from '@/features/alert-management-api/components/ManageColumnsButton';
import { PageWithFilters } from '@/features/alert-management-api/components/PageWithFilters';
import { SelectedFilters } from '@/features/alert-management-api/components/SelectedFilters';
import { TableColumnsModal } from '@/features/alert-management-api/components/TableColumnsModal';
import { useAlertManagementData } from '@/features/alert-management-api/hooks/useAlertManagementData';
import { useAlertManagementSort } from '@/features/alert-management-api/hooks/useAlertManagementSort';
import { RulesFilterPanel } from '@/features/alert-management-api/pages/rules-page/components/RulesFilterPanel';
import { RulesTable } from '@/features/alert-management-api/pages/rules-page/components/RulesTable';
import {
  defaultRuleColumns,
  defaultRuleFilters,
  filterRules,
  parseRuleColumns,
  requiredRuleColumns,
  ruleColumns,
  ruleFilterLabels,
  ruleLabel,
  toManagedRule,
} from '@/features/alert-management-api/pages/rules-page/utils/rules';
import { RuleFilterKey, RuleFilters } from '@/features/alert-management-api/types/types';
import {
  parseFilterParams,
  serializeFilterParams,
} from '@/features/alert-management-api/utils/filter-params';
import { defaultRuleSort, sortRules } from '@/features/alert-management-api/utils/sort-rules';
import { useTablePagination } from '@/shared/components/table/hooks/useTablePagination';
import { TablePagination } from '@/shared/components/table/TablePagination';
import { AccessDenied } from '@/shared/console/console-shared/src/components/empty-state/AccessDenied';
import { LoadingBox } from '@/shared/console/console-shared/src/components/loading/LoadingBox';
import { QueryParams } from '@/shared/constants/query-params';
import { getSeverityColors } from '@/shared/utils/alerts/formatting';
import { startCase } from '@/shared/utils/strings';

const filterKeys = Object.keys(ruleFilterLabels) as RuleFilterKey[];
const filtersId = 'alert-rule-filters';

export function AlertRulesManagementPage() {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { data, rulesQuery, silencedAlertsQuery } = useAlertManagementData();
  const [params, setParams] = useSearchParams();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const pagination = useTablePagination({ perPage: 20 });
  const { page, perPage, setPage } = pagination;

  const filters = useMemo(
    () => parseFilterParams(params, defaultRuleFilters, filterKeys),
    [params],
  );

  const columns = parseRuleColumns(params.get(QueryParams.Columns));

  const { sort, setSort } = useAlertManagementSort(columns, defaultRuleSort);
  const { column, direction } = sort;

  const managedRules = useMemo(() => (data?.rules ?? []).map(toManagedRule), [data?.rules]);

  const filteredRules = useMemo(
    () => sortRules(filterRules(managedRules, filters), { column, direction }),
    [managedRules, filters, column, direction],
  );

  const pageRules = filteredRules.slice((page - 1) * perPage, page * perPage);

  // Update all filters to new values, move to page one and reset selection
  const setFilters = (filters: RuleFilters) => {
    setParams((current) => {
      const next = serializeFilterParams(current, filters, filterKeys);
      next.set(QueryParams.Page, '1');
      return next;
    });
    setSelected(new Set());
  };

  // A refresh or browser navigation can shrink the result set, so reset page if it does not exist
  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(filteredRules.length / perPage));
    if (!rulesQuery.isLoading && page > lastPage) {
      setPage(lastPage, { replace: true });
    }
  }, [filteredRules, page, perPage, rulesQuery.isLoading, setPage]);

  if (rulesQuery.isLoading && !rulesQuery.data) {
    return <LoadingBox />;
  }

  if (rulesQuery.isError && !data) {
    return <AccessDenied message={rulesQuery.error?.message ?? ''} />;
  }

  return (
    <PageSection hasBodyWrapper={false} isFilled>
      {rulesQuery.isError && (
        <Alert isInline variant="warning" title={t('Alert rules could not be refreshed')}>
          {rulesQuery.error?.message}
        </Alert>
      )}
      {silencedAlertsQuery.isError && (
        <Alert isInline variant="warning" title={t('Silenced alerts could not be loaded')} />
      )}
      <PageWithFilters
        filtersId={filtersId}
        filters={
          filtersOpen && (
            <RulesFilterPanel
              rules={managedRules}
              filters={filters}
              onChange={setFilters}
              onClose={() => setFiltersOpen(false)}
            />
          )
        }
      >
        <Panel variant="bordered">
          <PanelHeader>
            <Title headingLevel="h2" size="lg">
              {t('Alert rules')}
            </Title>
          </PanelHeader>
          <Divider />
          <PanelMain>
            <PanelMainBody style={{ paddingBlock: 'var(--pf-t--global--spacer--sm)' }}>
              <Flex alignItems={{ default: 'alignItemsCenter' }}>
                <Button
                  variant="control"
                  icon={<RhUiFilterFillIcon />}
                  aria-expanded={filtersOpen}
                  aria-controls={filtersId}
                  aria-label={t('Open rule filters')}
                  onClick={() => setFiltersOpen((open) => !open)}
                >
                  {t('Filters')}
                </Button>
                <FlexItem grow={{ default: 'grow' }}>
                  <SearchInput
                    aria-label={t('Search by rule name')}
                    placeholder={t('Search by rule name')}
                    value={filters.name}
                    onChange={(_event, name) => setFilters({ ...filters, name })}
                    onClear={() => setFilters({ ...filters, name: '' })}
                  />
                </FlexItem>
                <FlexItem>
                  {/* TODO, keeping t & tooltip for later use */}
                  <Tooltip content={t('Rule editing is not available yet')}>
                    <Button variant="secondary" isAriaDisabled>
                      {t('Actions')}
                    </Button>
                  </Tooltip>
                </FlexItem>
                <FlexItem>
                  {/* TODO, keeping t & tooltip for later use */}
                  <Tooltip content={t('Rule creation is not available yet')}>
                    <Button variant="primary" isAriaDisabled>
                      {t('Create a new alert rule')}
                    </Button>
                  </Tooltip>
                </FlexItem>
              </Flex>
              <SelectedFilters<RuleFilters, RuleFilterKey>
                filters={filters}
                defaults={defaultRuleFilters}
                labels={ruleFilterLabels}
                onChange={setFilters}
                formatLabelText={(key, value) => {
                  if (key === 'labels' || key === 'namespace') {
                    return value;
                  }
                  if (key === 'managedBy') {
                    return ruleLabel(value, t);
                  }
                  if (key === 'source' || key === 'severity') {
                    return t(startCase(value));
                  }
                  return t(value);
                }}
                getLabelStatus={(key, value) =>
                  key === 'severity' ? getSeverityColors(value).labelStatus : undefined
                }
              />
            </PanelMainBody>
          </PanelMain>
          <Divider />
          <PanelMain>
            <PanelMainBody style={{ paddingBlock: 'var(--pf-t--global--spacer--sm)' }}>
              <TablePagination
                itemCount={filteredRules.length}
                {...pagination}
                variant="top"
                isCompact
                rightActions={<ManageColumnsButton onClick={() => setColumnsOpen(true)} />}
              />
              <Divider style={{ marginBlockStart: 'var(--pf-t--global--spacer--sm)' }} />
              <InnerScrollContainer
                tabIndex={0}
                role="region"
                aria-label={t('Alert rules table scroll area')}
              >
                <RulesTable
                  rules={pageRules}
                  columns={columns}
                  sort={sort}
                  onSort={(column, direction) => setSort({ column, direction })}
                  selected={selected}
                  onSelect={(ids, checked) => {
                    setSelected((current) => {
                      const next = new Set(current);
                      ids.forEach((id) => {
                        if (checked) next.add(id);
                        else next.delete(id);
                      });
                      return next;
                    });
                  }}
                />
              </InnerScrollContainer>
              {filteredRules.length > 0 && (
                <TablePagination
                  itemCount={filteredRules.length}
                  {...pagination}
                  variant="bottom"
                />
              )}
            </PanelMainBody>
          </PanelMain>
        </Panel>
      </PageWithFilters>
      {columnsOpen && (
        <TableColumnsModal
          isOpen
          definitions={ruleColumns}
          columns={columns}
          defaults={defaultRuleColumns}
          required={requiredRuleColumns}
          onClose={() => setColumnsOpen(false)}
          onSave={(columns) => {
            setParams((current) => {
              const next = new URLSearchParams(current);
              next.set(QueryParams.Columns, JSON.stringify(columns));
              if (!columns.includes(column)) {
                next.delete(QueryParams.Sort);
                next.delete(QueryParams.SortDirection);
              }
              return next;
            });
            setColumnsOpen(false);
          }}
        />
      )}
    </PageSection>
  );
}
