import { AlertStates } from '@openshift-console/dynamic-plugin-sdk';
import { Button, Divider, Flex, Title, ToggleGroup, ToggleGroupItem } from '@patternfly/react-core';
import { CogIcon, CubesIcon, RhUiFilterFillIcon, TimesIcon } from '@patternfly/react-icons';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { AlertFilterLabel } from '@/features/alert-management-api/components/AlertFilterLabel';
import { AlertFilterSelect } from '@/features/alert-management-api/components/AlertFilterSelect';
import { AlertSeverityButton } from '@/features/alert-management-api/components/AlertSeverityButton';
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
type MultiFilter = Exclude<keyof AlertFilters, 'firingTime' | 'name'>;
const emptyHint: Partial<Record<DropdownFilter, string>> = {
  labels: 'Showing all labels',
  component: 'Showing all components',
};

export function AlertsFilterDrawer({ alerts, filters, onChange, onClose }: Props) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const labels = {
    labels: t('Alert labels'),
    component: t('Affected component'),
    severity: t('Severity'),
    state: t('State'),
    source: t('Source'),
    scope: t('Scope'),
  };

  const toggle = (key: MultiFilter, value: string, checked: boolean) => {
    const values = checked
      ? [...filters[key], value]
      : filters[key].filter((item) => item !== value);
    onChange({ ...filters, [key]: values });
  };

  const dropdownFilter = (key: DropdownFilter, placeholder: string) => {
    const options = filterOptionsByKey(alerts, key).map((option) => ({
      ...option,
      label:
        key === 'state'
          ? getAlertStateKey(option.value as AlertStates, t)
          : key === 'source'
            ? getSourceKey(startCase(option.value), t)
            : option.label,
    }));

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
        labelTooltip={key === 'component' ? 'Affected components tooltip' : undefined}
        searchLabel={key === 'labels' ? 'Search alert labels' : undefined}
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
      <AlertFilterSelect
        filterKey="namespace"
        label="Namespace"
        icon={<CubesIcon aria-hidden />}
        placeholder="Select namespaces"
        emptyHint="Showing all namespaces"
        emptyOptionsLabel="No namespaces found"
        searchLabel="Search namespaces"
        searchPlaceholder="Search namespaces..."
        options={filterOptionsByKey(alerts, 'namespace')}
        selected={filters.namespace}
        onChange={(namespace) => onChange({ ...filters, namespace })}
      />
      <Divider />
      {dropdownFilter('labels', 'Select labels')}
      <Divider />
      <div>
        <strong>{labels.severity}</strong>
        <Flex spaceItems={{ default: 'spaceItemsSm' }}>
          {filterOptionsByKey(alerts, 'severity').map(({ value: severity }) => {
            return (
              <AlertSeverityButton
                key={severity}
                severity={severity}
                isDimmed={filters.severity.length > 0 && !filters.severity.includes(severity)}
                onClick={() => toggle('severity', severity, !filters.severity.includes(severity))}
              />
            );
          })}
        </Flex>
      </div>
      <Divider />
      <div>
        <AlertFilterLabel label="Alert scope" tooltip="Alert scope tooltip" />
        <ToggleGroup isCompact aria-label={labels.scope}>
          <ToggleGroupItem
            text={t('All')}
            isSelected={filters.scope.length === 0}
            onChange={() => onChange({ ...filters, scope: [] })}
          />
          {['Cluster', 'Namespace'].map((scope) => (
            <ToggleGroupItem
              key={scope}
              text={t(scope)}
              isSelected={filters.scope.length === 1 && filters.scope[0] === scope}
              onChange={(_event, selected) =>
                onChange({ ...filters, scope: selected ? [scope] : [] })
              }
            />
          ))}
        </ToggleGroup>
      </div>
      <Divider />
      {dropdownFilter('component', 'Select components')}
      <Divider />
      <strong>{t('Alert Filters')}</strong>
      {dropdownFilter('state', 'State')}
      {dropdownFilter('source', 'Source')}
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
