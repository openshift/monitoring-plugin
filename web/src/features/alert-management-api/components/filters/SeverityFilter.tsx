import { Flex } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';

import { AlertSeverityButton } from '@/features/alert-management-api/components/filters/AlertSeverityButton';
import type { AlertFilterOption } from '@/features/alert-management-api/types/types';

type SeverityFilterProps = {
  options: AlertFilterOption[];
  selected: string[];
  onChange: (severities: string[]) => void;
  getAriaLabel?: (severity: string) => string;
};

export function SeverityFilter({ options, selected, onChange, getAriaLabel }: SeverityFilterProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <div>
      <strong>{t('Severity')}</strong>
      <Flex
        spaceItems={{ default: 'spaceItemsNone' }}
        columnGap={{ default: 'columnGapSm' }}
        rowGap={{ default: 'rowGapSm' }}
      >
        {options.map(({ value }) => (
          <AlertSeverityButton
            key={value}
            severity={value}
            ariaLabel={getAriaLabel?.(value)}
            isPressed={selected.includes(value)}
            isDimmed={selected.length > 0 && !selected.includes(value)}
            onClick={() =>
              onChange(
                selected.includes(value)
                  ? selected.filter((severity) => severity !== value)
                  : [...selected, value],
              )
            }
          />
        ))}
      </Flex>
    </div>
  );
}
