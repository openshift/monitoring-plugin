import { Button, Tooltip } from '@patternfly/react-core';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { SeverityBadge, SeverityIcon } from '@/shared/components/SeverityBadge';
import { getSeverityColors } from '@/shared/utils/alerts/formatting';
import { startCase } from '@/shared/utils/strings';

export function AlertSeverityButton({
  severity,
  count,
  isDimmed = false,
  onClick,
}: {
  severity: string;
  count?: number;
  isDimmed?: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const color = count !== undefined ? getSeverityColors(severity).textColor : undefined;

  return (
    <Tooltip content={t(startCase(severity)) + (count !== undefined ? `: ${count}` : '')}>
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
        {count ?? <SeverityBadge severity={severity} isDimmed={isDimmed} />}
      </Button>
    </Tooltip>
  );
}
