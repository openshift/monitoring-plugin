import { Button, Flex, FlexItem, Label, LabelGroup, LabelProps } from '@patternfly/react-core';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

type SelectedFiltersProps<T, K extends keyof T> = {
  filters: T & Record<K, string[]>;
  defaults: T;
  labels: Record<K, string>;
  getLabelColor?: (key: K, value: string) => LabelProps['color'];
  getLabelStatus?: (key: K, value: string) => LabelProps['status'];
  formatLabelText: (key: K, value: string) => string;
  onChange: (filters: T) => void;
};

export function SelectedFilters<T, K extends keyof T>({
  filters,
  defaults,
  labels,
  getLabelColor,
  getLabelStatus,
  formatLabelText,
  onChange,
}: SelectedFiltersProps<T, K>) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const selectedKeys = (Object.keys(labels) as K[]).filter((key) => filters[key].length > 0);

  if (selectedKeys.length === 0) {
    return null;
  }

  return (
    <Flex
      alignItems={{ default: 'alignItemsCenter' }}
      style={{ paddingBlockStart: 'var(--pf-t--global--spacer--sm)' }}
    >
      {selectedKeys.map((key) => (
        <FlexItem key={String(key)}>
          <LabelGroup categoryName={t(labels[key])} isCompact>
            {filters[key].map((value) => (
              <Label
                key={value}
                color={getLabelColor?.(key, value)}
                status={getLabelStatus?.(key, value)}
                onClose={() =>
                  onChange({
                    ...filters,
                    [key]: filters[key].filter((selected) => selected !== value),
                  })
                }
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
          onClick={() => onChange(defaults)}
          style={
            {
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
