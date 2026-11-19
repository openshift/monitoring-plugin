import { CubesIcon } from '@patternfly/react-icons';

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
  return (
    <AlertFilterSelect
      filterKey={filterKey}
      label="Namespace"
      icon={<CubesIcon aria-hidden />}
      placeholder="Select namespaces"
      emptyHint="Showing all namespaces"
      emptyOptionsLabel="No namespaces found"
      searchLabel="Search namespaces"
      searchPlaceholder="Search namespaces..."
      options={options}
      selected={selected}
      onChange={onChange}
    />
  );
}
