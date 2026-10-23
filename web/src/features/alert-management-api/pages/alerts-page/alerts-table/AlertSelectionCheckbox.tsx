import { Checkbox } from '@patternfly/react-core';
import { useLayoutEffect } from 'react';

import type { ManagedAlert } from '@/features/alert-management-api/types/types';
import { getAlertStableKey } from '@/features/alert-management-api/utils/alerts';

export type AlertSelection = {
  selectedAlertKeys: Set<string>;
  onSelectionChange: (nextSelectedAlertKeys: Set<string>) => void;
};

type AlertSelectionCheckboxProps = AlertSelection & {
  alerts: ManagedAlert[];
  label: string;
  id: string;
};

export function AlertSelectionCheckbox({
  alerts,
  label,
  id,
  selectedAlertKeys,
  onSelectionChange,
}: AlertSelectionCheckboxProps) {
  const selectedCount = alerts.filter((alert) =>
    selectedAlertKeys.has(getAlertStableKey(alert)),
  ).length;
  const isIndeterminate = selectedCount > 0 && selectedCount < alerts.length;

  useLayoutEffect(() => {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (input) input.indeterminate = isIndeterminate;
  });

  return (
    <Checkbox
      id={id}
      aria-label={label}
      isChecked={selectedCount > 0 && selectedCount === alerts.length}
      aria-checked={isIndeterminate ? 'mixed' : undefined}
      onChange={(_event, checked) => {
        const nextSelected = new Set(selectedAlertKeys);
        alerts.forEach((alert) => {
          const key = getAlertStableKey(alert);
          if (checked) nextSelected.add(key);
          else nextSelected.delete(key);
        });
        onSelectionChange(nextSelected);
      }}
    />
  );
}
