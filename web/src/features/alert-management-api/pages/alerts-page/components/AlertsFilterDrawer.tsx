import { AlertStates } from '@openshift-console/dynamic-plugin-sdk';
import { Button, Divider, Flex, Title } from '@patternfly/react-core';
import { CogIcon, RhUiFilterFillIcon, TimesIcon } from '@patternfly/react-icons';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { AlertFilterSelect } from '@/features/alert-management-api/components/AlertFilterSelect';
import { NamespaceFilter } from '@/features/alert-management-api/components/NamespaceFilter';
import { ScopeFilter } from '@/features/alert-management-api/components/ScopeFilter';
import { SeverityFilter } from '@/features/alert-management-api/components/SeverityFilter';
import { AlertFilters, ManagedAlert } from '@/features/alert-management-api/types/types';
import {
  defaultAlertFilters,
  filterOptionsByKey,
} from '@/features/alert-management-api/utils/alerts';
import { AlertState, getAlertStateKey } from '@/shared/components/AlertState';
import { getSourceKey } from '@/shared/utils/alerts/alert-source';
import { startCase } from '@/shared/utils/strings';

type Props = {
  alerts: ManagedAlert[];
  filters: AlertFilters;
  onChange: (filters: AlertFilters) => void;
  onClose: () => void;
};

type DropdownFilter = 'labels' | 'component' | 'state' | 'source';
export function AlertsFilterDrawer({ alerts, filters, onChange, onClose }: Props) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const labels = {
    labels: t('Alert labels'),
    component: t('Affected component'),
    state: t('State'),
    source: t('Source'),
  };
  const emptyHint: Partial<Record<DropdownFilter, string>> = {
    labels: t('Showing all labels'),
    component: t('Showing all components'),
  };

  const dropdownFilter = (key: DropdownFilter, placeholder: string) => {
    const options = filterOptionsByKey(alerts, key).map((option) => {
      let label = option.label;
      if (key === 'state') {
        label = getAlertStateKey(option.value as AlertStates, t);
      } else if (key === 'source') {
        label = getSourceKey(startCase(option.value), t);
      }
      return { ...option, label };
    });

    return (
      <AlertFilterSelect
        key={key}
        filterKey={key}
        label={labels[key]}
        hideLabel={key === 'state' || key === 'source'}
        icon={
          key === 'labels' ? (
            <RhUiFilterFillIcon aria-hidden />
          ) : key === 'component' ? (
            <CogIcon aria-hidden />
          ) : undefined
        }
        placeholder={placeholder}
        options={options}
        renderOptionLabel={
          key === 'state' ? ({ value }) => <AlertState state={value as AlertStates} /> : undefined
        }
        selected={filters[key]}
        onChange={(values) => onChange({ ...filters, [key]: values } as AlertFilters)}
        emptyHint={emptyHint[key]}
        labelTooltip={key === 'component' ? t('Affected components tooltip') : undefined}
        searchLabel={key === 'labels' ? t('Search alert labels') : undefined}
      />
    );
  };

  return (
    <Flex
      direction={{ default: 'column' }}
      alignItems={{ default: 'alignItemsStretch' }}
      spaceItems={{ default: 'spaceItemsMd' }}
    >
      <Flex
        justifyContent={{ default: 'justifyContentSpaceBetween' }}
        alignItems={{ default: 'alignItemsCenter' }}
        flexWrap={{ default: 'nowrap' }}
      >
        <Title headingLevel="h2" size="md">
          <RhUiFilterFillIcon aria-hidden /> {t('Filter alerts')}
        </Title>
        <Button
          variant="plain"
          aria-label={t('Close')}
          icon={<TimesIcon />}
          onClick={onClose}
          style={
            {
              // Keep the close-button hover squarish instead of the theme's pill radius.
              '--pf-v6-c-button--m-plain--BorderRadius':
                'var(--pf-t--global--border--radius--small)',
            } as CSSProperties
          }
        />
      </Flex>
      <NamespaceFilter
        options={filterOptionsByKey(alerts, 'namespace')}
        selected={filters.namespace}
        onChange={(namespace) => onChange({ ...filters, namespace })}
      />
      <Divider />
      {dropdownFilter('labels', t('Select labels'))}
      <Divider />
      <SeverityFilter
        options={filterOptionsByKey(alerts, 'severity')}
        selected={filters.severity}
        onChange={(severity) => onChange({ ...filters, severity })}
      />
      <Divider />
      <ScopeFilter
        selected={filters.scope}
        ariaLabel={t('Scope')}
        onChange={(scope) => onChange({ ...filters, scope })}
      />
      <Divider />
      {dropdownFilter('component', t('Select components'))}
      <Divider />
      <strong>{t('Alert Filters')}</strong>
      {dropdownFilter('state', t('State'))}
      {dropdownFilter('source', t('Source'))}
      {Object.values(filters).some((value) => value.length > 0) && (
        <>
          <Divider />
          <Button variant="link" onClick={() => onChange(defaultAlertFilters)}>
            {t('Clear all filters')}
          </Button>
        </>
      )}
    </Flex>
  );
}
