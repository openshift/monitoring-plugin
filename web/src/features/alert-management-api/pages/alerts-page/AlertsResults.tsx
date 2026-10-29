import {
  ActionList,
  ActionListGroup,
  ActionListItem,
  Button,
  Divider,
  Flex,
  FlexItem,
  PanelMain,
  PanelMainBody,
  Switch,
  Tooltip,
} from '@patternfly/react-core';
import { BellSlashIcon, ColumnsIcon } from '@patternfly/react-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { useQueryParam } from 'use-query-params';

import { ManageColumnsModal } from '@/features/alert-management-api/components/ManageColumnsModal';
import { useAlertManagementSort } from '@/features/alert-management-api/hooks/useAlertManagementSort';
import { AlertsTable } from '@/features/alert-management-api/pages/alerts-page/alerts-table/AlertsTable';
import type { AlertsTableRef } from '@/features/alert-management-api/pages/alerts-page/alerts-table/AlertsTable';
import { ExportAlertsButton } from '@/features/alert-management-api/pages/alerts-page/components/ExportAlertsButton';
import { GroupByDropdown } from '@/features/alert-management-api/pages/alerts-page/components/GroupByDropdown';
import {
  AlertColumn,
  parseAlertColumns,
} from '@/features/alert-management-api/pages/alerts-page/utils/alert-columns';
import { AlertGroupByParam } from '@/features/alert-management-api/pages/alerts-page/utils/alert-group-by-param';
import {
  AlertGroupBy,
  groupAlerts,
  paginateAlertGroups,
} from '@/features/alert-management-api/pages/alerts-page/utils/group-alerts';
import { AlertFilters, ManagedAlert } from '@/features/alert-management-api/types/types';
import { filterAlerts, getAlertStableKey } from '@/features/alert-management-api/utils/alerts';
import { useTablePagination } from '@/shared/components/table/hooks/useTablePagination';
import { TablePagination } from '@/shared/components/table/TablePagination';
import { DataTestIDs } from '@/shared/constants/data-test';
import { QueryParams } from '@/shared/constants/query-params';

type AlertsResultsProps = {
  alerts: ManagedAlert[];
  filters: AlertFilters;
};

export function AlertsResults({ alerts, filters }: AlertsResultsProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const [searchParams, setSearchParams] = useSearchParams();
  const [groupBy] = useQueryParam(QueryParams.GroupBy, AlertGroupByParam);
  const previousGroupBy = useRef(groupBy);

  const alertsTableRef = useRef<AlertsTableRef>(null);

  const isAggregated = searchParams.get(QueryParams.Aggregate) !== '0';

  const columnsParam = searchParams.get('columns');
  const visibleColumns = useMemo(() => parseAlertColumns(columnsParam), [columnsParam]);
  const [isManageColumnsOpen, setManageColumnsOpen] = useState(false);

  const [selectedAlertKeys, setSelectedAlertKeys] = useState<Set<string>>(() => new Set());

  const { sort, setSort } = useAlertManagementSort();
  const { column, direction } = sort;
  const pagination = useTablePagination({ perPage: 20 });
  const { page, perPage, onSetPage } = pagination;

  const filterKey = JSON.stringify(filters);
  const previousFilters = useRef(filterKey);

  const filteredAlerts = useMemo(() => filterAlerts(alerts, filters), [alerts, filters]);
  const groups = useMemo(
    () => groupAlerts(filteredAlerts, groupBy, isAggregated, { column, direction }),
    [filteredAlerts, groupBy, isAggregated, column, direction],
  );
  const aggregatedAlerts = groups.flatMap((group) => group.rows);
  const pageGroups = paginateAlertGroups(groups, page, perPage);
  const pageAlerts = pageGroups.flatMap((group) => group.rows);

  const selectedAlerts = filteredAlerts.filter((alert) =>
    selectedAlertKeys.has(getAlertStableKey(alert)),
  );

  useEffect(() => {
    if (previousFilters.current !== filterKey || previousGroupBy.current !== groupBy) {
      previousFilters.current = filterKey;
      previousGroupBy.current = groupBy;
      onSetPage(undefined, 1);
    } else {
      const lastPage = Math.max(1, Math.ceil(aggregatedAlerts.length / perPage));
      if (page > lastPage) onSetPage(undefined, lastPage);
    }
  }, [filterKey, groupBy, aggregatedAlerts.length, page, perPage, onSetPage]);

  const saveColumns = (newColumns: AlertColumn[]) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('columns', JSON.stringify(newColumns));
      if (!newColumns.includes(sort.column)) {
        next.delete('sort');
        next.delete('sortDirection');
        next.set('page', '1');
      }
      return next;
    });
  };

  return (
    <PanelMain>
      <PanelMainBody style={{ paddingBlock: 'var(--pf-t--global--spacer--sm)' }}>
        <TablePagination
          itemCount={aggregatedAlerts.length}
          page={page}
          perPage={perPage}
          onSetPage={pagination.onSetPage}
          onPerPageSelect={pagination.onPerPageSelect}
          variant="top"
          isCompact
          leftActions={
            <LayoutControls
              groupBy={groupBy}
              isAggregated={isAggregated}
              onExpandAllGroups={() => alertsTableRef.current?.expandAllGroups()}
              onCollapseAllGroups={() => alertsTableRef.current?.collapseAllGroups()}
              onAggregateChange={(checked) => {
                pagination.onSetPage(undefined, 1);
                setSearchParams((current) => {
                  const next = new URLSearchParams(current);
                  if (checked) {
                    next.delete(QueryParams.Aggregate);
                  } else {
                    next.set(QueryParams.Aggregate, '0');
                  }
                  if (page !== 1) {
                    next.set('page', '1');
                  }
                  if (!checked && sort.column === 'total') {
                    next.delete('sort');
                    next.delete('sortDirection');
                  }
                  return next;
                });
              }}
            />
          }
          rightActions={
            <Flex alignItems={{ default: 'alignItemsCenter' }}>
              {selectedAlerts.length > 0 && (
                <FlexItem>
                  <Button
                    variant="secondary"
                    icon={<BellSlashIcon />}
                    onClick={() =>
                      // eslint-disable-next-line no-console
                      console.debug(
                        `silencing ${selectedAlerts.length} alerts: ${selectedAlerts
                          .map((alert) => alert.labels.alertname ?? alert.rule.name)
                          .join(', ')}`,
                      )
                    }
                  >
                    {t('Silence ({{selectedCount}})', {
                      selectedCount: selectedAlerts.length,
                    })}
                  </Button>
                </FlexItem>
              )}
              <FlexItem>
                <ActionList isIconList>
                  <ActionListItem>
                    <Tooltip content={t('Manage columns')}>
                      <Button
                        variant="control"
                        icon={<ColumnsIcon />}
                        aria-label={t('Manage columns')}
                        onClick={() => setManageColumnsOpen(true)}
                      />
                    </Tooltip>
                  </ActionListItem>
                  <ActionListItem>
                    <ExportAlertsButton alerts={aggregatedAlerts} />
                  </ActionListItem>
                </ActionList>
              </FlexItem>
            </Flex>
          }
        />
        <Divider style={{ marginBlockStart: 'var(--pf-t--global--spacer--sm)' }} />
        <AlertsTable
          ref={alertsTableRef}
          aggregatedAlerts={pageAlerts}
          pageGroups={pageGroups}
          groupBy={groupBy}
          isAggregated={isAggregated}
          columns={visibleColumns}
          sort={sort}
          selectedAlertKeys={selectedAlertKeys}
          onSelectionChange={setSelectedAlertKeys}
          onSort={(nextSort) => {
            pagination.onSetPage(undefined, 1);
            setSort(nextSort);
          }}
        />
        {aggregatedAlerts.length > 0 && (
          <TablePagination
            itemCount={aggregatedAlerts.length}
            page={page}
            perPage={perPage}
            onSetPage={pagination.onSetPage}
            onPerPageSelect={pagination.onPerPageSelect}
            variant="bottom"
          />
        )}
        {isManageColumnsOpen && (
          <ManageColumnsModal
            isOpen={isManageColumnsOpen}
            isAggregated={isAggregated}
            columns={visibleColumns}
            onSave={(columns) => {
              saveColumns(columns);
              setManageColumnsOpen(false);
            }}
            onClose={() => setManageColumnsOpen(false)}
          />
        )}
      </PanelMainBody>
    </PanelMain>
  );
}

function LayoutControls({
  groupBy,
  isAggregated,
  onExpandAllGroups,
  onCollapseAllGroups,
  onAggregateChange,
}: {
  groupBy: AlertGroupBy;
  isAggregated: boolean;
  onExpandAllGroups: () => void;
  onCollapseAllGroups: () => void;
  onAggregateChange: (checked: boolean) => void;
}) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Flex alignItems={{ default: 'alignItemsCenter' }}>
      <FlexItem>
        <strong>{t('Layout')}</strong>
      </FlexItem>
      <FlexItem>
        <GroupByDropdown />
      </FlexItem>
      {groupBy !== AlertGroupBy.None && (
        <FlexItem>
          <ActionList>
            <ActionListGroup>
              <ActionListItem>
                <Button
                  variant="link"
                  isInline
                  aria-label={t('Expand all groups on this page')}
                  onClick={onExpandAllGroups}
                >
                  {t('Expand all')}
                </Button>
              </ActionListItem>
              <ActionListItem>
                <Button
                  variant="link"
                  isInline
                  aria-label={t('Collapse all groups on this page')}
                  onClick={onCollapseAllGroups}
                >
                  {t('Collapse all')}
                </Button>
              </ActionListItem>
            </ActionListGroup>
          </ActionList>
        </FlexItem>
      )}
      <FlexItem>
        <Switch
          id={DataTestIDs.AlertManagementAPI.AggregateIdenticalAlertsSwitch}
          label={t('Aggregate identical alerts')}
          isChecked={isAggregated}
          onChange={(_event, checked) => onAggregateChange(checked)}
        />
      </FlexItem>
    </Flex>
  );
}
