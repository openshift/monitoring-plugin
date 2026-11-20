import { Button, Divider, Flex, Title } from '@patternfly/react-core';
import { RhUiFilterFillIcon, TimesIcon } from '@patternfly/react-icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { AlertFilterSelect } from '@/features/alert-management-api/components/AlertFilterSelect';
import { NamespaceFilter } from '@/features/alert-management-api/components/NamespaceFilter';
import { ScopeFilter } from '@/features/alert-management-api/components/ScopeFilter';
import { SeverityFilter } from '@/features/alert-management-api/components/SeverityFilter';
import { getRuleFilterOptions } from '@/features/alert-management-api/pages/rules-page/utils/rule-filter-options';
import {
  defaultRuleFilters,
  ruleFilterLabels,
  ruleLabel,
} from '@/features/alert-management-api/pages/rules-page/utils/rules';
import { ManagedRule, RuleFilters } from '@/features/alert-management-api/types/types';
import { AlertRuleState, AlertRuleStateValue } from '@/shared/components/AlertRuleState';

type RulesFilterPanelProps = {
  rules: ManagedRule[];
  filters: RuleFilters;
  onChange: (filters: RuleFilters) => void;
  onClose: () => void;
};

export function RulesFilterPanel({ rules, filters, onChange, onClose }: RulesFilterPanelProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const options = useMemo(() => getRuleFilterOptions(rules, t), [rules, t]);

  return (
    <Flex
      direction={{ default: 'column' }}
      alignItems={{ default: 'alignItemsStretch' }}
      spaceItems={{ default: 'spaceItemsMd' }}
    >
      <Flex
        justifyContent={{ default: 'justifyContentSpaceBetween' }}
        alignItems={{ default: 'alignItemsCenter' }}
      >
        <Title headingLevel="h2" size="md">
          <RhUiFilterFillIcon aria-hidden /> {t('Filter rules')}
        </Title>
        <Button variant="plain" aria-label={t('Close')} icon={<TimesIcon />} onClick={onClose} />
      </Flex>
      <NamespaceFilter
        filterKey="rule-namespace"
        options={options.namespace}
        selected={filters.namespace}
        onChange={(namespace) => onChange({ ...filters, namespace })}
      />
      <Divider />
      <AlertFilterSelect
        filterKey="rule-labels"
        label={t('Rule labels')}
        icon={<RhUiFilterFillIcon aria-hidden />}
        placeholder={t('Select labels')}
        emptyHint={t('Showing all labels')}
        searchLabel={t('Search rule labels')}
        options={options.labels}
        selected={filters.labels}
        onChange={(labels) => onChange({ ...filters, labels })}
      />
      <Divider />
      <SeverityFilter
        options={options.severity}
        selected={filters.severity}
        getAriaLabel={(severity) => t('Filter {{severity}} rules', { severity })}
        onChange={(severity) => onChange({ ...filters, severity })}
      />
      <Divider />
      <ScopeFilter selected={filters.scope} onChange={(scope) => onChange({ ...filters, scope })} />
      <Divider />
      {(['component', 'enablement', 'alertStates', 'source', 'managedBy'] as const).map((key) => (
        <AlertFilterSelect
          key={key}
          filterKey={`rule-${key}`}
          label={ruleLabel(ruleFilterLabels[key], t)}
          placeholder={ruleLabel(ruleFilterLabels[key], t)}
          options={options[key]}
          renderOptionLabel={
            key === 'enablement'
              ? ({ value }) => <AlertRuleState state={value.toLowerCase() as AlertRuleStateValue} />
              : undefined
          }
          selected={filters[key]}
          onChange={(values) => onChange({ ...filters, [key]: values })}
        />
      ))}
      <Divider />
      <Button variant="link" onClick={() => onChange(defaultRuleFilters)}>
        {t('Clear all filters')}
      </Button>
    </Flex>
  );
}
