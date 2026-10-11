import { Button } from '@patternfly/react-core';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { SeverityBadge, SeverityIcon } from '@/shared/components/SeverityBadge';
import { getSeverityColors } from '@/shared/utils/alerts/formatting';

export function AlertSeverityButton({
  severity,
  count,
  onClick,
}: {
  severity: string;
  count?: number;
  onClick: () => void;
}) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const color = count !== undefined ? getSeverityColors(severity).textColor : undefined;

  return (
    <Button
      size="sm"
      variant="plain"
      hasNoPadding={count === undefined}
      style={
        {
          color,
          // the console react versions has rounded boarders for this component
          //  keep the plain-button hover squarish.
          '--pf-v6-c-button--m-plain--BorderRadius': 'var(--pf-t--global--border--radius--small)',
        } as CSSProperties
      }
      icon={
        count !== undefined ? (
          <SeverityIcon severity={severity} aria-hidden color={color} />
        ) : undefined
      }
      aria-label={t('Filter {{severity}} alerts', { severity })}
      onClick={onClick}
    >
      {count ?? <SeverityBadge severity={severity} />}
    </Button>
  );
}
