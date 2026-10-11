import { Button, Flex, FlexItem, Label, LabelGroup, LabelProps } from '@patternfly/react-core';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import type { SelectedAlertFilterKey } from '@/features/alert-management-api/pages/alerts-page/utils/filter-labels';
import type { AlertFilters } from '@/features/alert-management-api/types/types';
import { defaultAlertFilters } from '@/features/alert-management-api/utils/alerts';

type SelectedFiltersProps = {
  filters: AlertFilters;
  labels: Record<SelectedAlertFilterKey, string>;
  getLabelColor: (key: SelectedAlertFilterKey, value: string) => LabelProps['color'];
  formatLabelText: (key: SelectedAlertFilterKey, value: string) => string;
  onChange: (filters: AlertFilters) => void;
};

export function SelectedFilters({
  filters,
  labels,
  getLabelColor,
  formatLabelText,
  onChange,
}: SelectedFiltersProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const selectedKeys = (Object.keys(labels) as SelectedAlertFilterKey[]).filter(
    (key) => filters[key].length > 0,
  );
  const removeFilter = (key: SelectedAlertFilterKey, value: string) =>
    onChange({
      ...filters,
      [key]: filters[key].filter((selected) => selected !== value),
    } as AlertFilters);

  if (selectedKeys.length === 0) {
    return null;
  }

  return (
    <Flex
      alignItems={{ default: 'alignItemsCenter' }}
      style={{ paddingBlockStart: 'var(--pf-t--global--spacer--sm)' }}
    >
      {selectedKeys.map((key) => (
        <FlexItem key={key}>
          <LabelGroup categoryName={t(labels[key])} isCompact>
            {filters[key].map((value) => (
              <Label
                key={value}
                color={getLabelColor(key, value)}
                onClose={() => removeFilter(key, value)}
                closeBtnAriaLabel={t('Remove filter')}
              >
                {formatLabelText(key, value)}
              </Label>
            ))}
          </LabelGroup>
        </FlexItem>
      ))}
      <FlexItem>
        <Button
          variant="link"
          onClick={() => onChange(defaultAlertFilters)}
          style={
            {
              // Match the squarish hover of the header actions instead of the theme's pill radius.
              '--pf-v6-c-button--m-link--BorderRadius':
                'var(--pf-t--global--border--radius--small)',
            } as CSSProperties
          }
        >
          {t('Clear filters')}
        </Button>
      </FlexItem>
    </Flex>
  );
}
