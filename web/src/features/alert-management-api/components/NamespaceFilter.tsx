import { CubesIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';

import { AlertFilterSelect } from '@/features/alert-management-api/components/AlertFilterSelect';
import { AlertFilterOption } from '@/features/alert-management-api/types/types';

type NamespaceFilterProps = {
  filterKey?: string;
  options: AlertFilterOption[];
  selected: string[];
  onChange: (namespaces: string[]) => void;
};

export function NamespaceFilter({
  filterKey = 'namespace',
  options,
  selected,
  onChange,
}: NamespaceFilterProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <AlertFilterSelect
      filterKey={filterKey}
      label={t('Namespace')}
      icon={<CubesIcon aria-hidden />}
      placeholder={t('Select namespaces')}
      emptyHint={t('Showing all namespaces')}
      emptyOptionsLabel={t('No namespaces found')}
      searchLabel={t('Search namespaces')}
      searchPlaceholder={t('Search namespaces...')}
      options={options}
      selected={selected}
      onChange={onChange}
    />
  );
}
