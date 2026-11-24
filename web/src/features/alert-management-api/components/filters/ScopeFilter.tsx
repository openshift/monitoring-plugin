import { ToggleGroup, ToggleGroupItem } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';

import { AlertFilterLabel } from '@/features/alert-management-api/components/filters/AlertFilterLabel';

type ScopeFilterProps = {
  selected: string[];
  onChange: (scopes: string[]) => void;
  ariaLabel?: string;
};

export function ScopeFilter({ selected, onChange, ariaLabel }: ScopeFilterProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const scopes = [
    { value: 'Cluster', label: t('Cluster') },
    { value: 'Namespace', label: t('Namespace') },
  ];

  return (
    <div>
      <AlertFilterLabel label={t('Alert scope')} tooltip={t('Alert scope tooltip')} />
      <ToggleGroup isCompact aria-label={ariaLabel ?? t('Alert scope')}>
        <ToggleGroupItem
          text={t('All')}
          isSelected={selected.length === 0}
          onChange={() => onChange([])}
        />
        {scopes.map(({ value, label }) => (
          <ToggleGroupItem
            key={value}
            text={label}
            isSelected={selected.includes(value)}
            onChange={() => onChange([value])}
          />
        ))}
      </ToggleGroup>
    </div>
  );
}
