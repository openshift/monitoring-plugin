import { ToggleGroup, ToggleGroupItem } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';

import { AlertFilterLabel } from '@/features/alert-management-api/components/AlertFilterLabel';

type ScopeFilterProps = {
  selected: string[];
  onChange: (scopes: string[]) => void;
  ariaLabel?: string;
};

export function ScopeFilter({ selected, onChange, ariaLabel }: ScopeFilterProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <div>
      <AlertFilterLabel label="Alert scope" tooltip="Alert scope tooltip" />
      <ToggleGroup isCompact aria-label={ariaLabel ?? t('Alert scope')}>
        <ToggleGroupItem
          text={t('All')}
          isSelected={selected.length === 0}
          onChange={() => onChange([])}
        />
        {['Cluster', 'Namespace'].map((scope) => (
          <ToggleGroupItem
            key={scope}
            text={t(scope)}
            isSelected={selected.includes(scope)}
            onChange={() => onChange([scope])}
          />
        ))}
      </ToggleGroup>
    </div>
  );
}
