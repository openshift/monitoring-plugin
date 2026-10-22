import { AlertSeverity } from '@openshift-console/dynamic-plugin-sdk';
import { Label } from '@patternfly/react-core';
import {
  RhUiErrorFillIcon,
  RhUiInformationFillIcon,
  RhUiWarningFillIcon,
  SeverityUndefinedIcon,
} from '@patternfly/react-icons';
import {
  t_global_icon_color_severity_undefined_default,
  t_global_icon_color_subtle,
  t_global_text_color_subtle,
} from '@patternfly/react-tokens';
import * as _ from 'lodash-es';
import { CSSProperties, memo } from 'react';
import { useTranslation } from 'react-i18next';

import { getSeverityColors } from '@/shared/utils/alerts/formatting';

const severityIcons: Record<string, typeof RhUiErrorFillIcon> = {
  [AlertSeverity.Critical]: RhUiErrorFillIcon,
  [AlertSeverity.Warning]: RhUiWarningFillIcon,
  [AlertSeverity.Info]: RhUiInformationFillIcon,
};

export const SeverityIcon = memo(function SeverityIcon({
  severity,
  color,
  'aria-hidden': ariaHidden,
}: {
  severity: string;
  color?: string;
  'aria-hidden'?: boolean;
}) {
  const Icon = severityIcons[severity] ?? SeverityUndefinedIcon;
  return <Icon aria-hidden={ariaHidden} color={color} />;
});

const getSeverityKey = (severity: string, t) => {
  switch (severity) {
    case AlertSeverity.Critical:
      return t('Critical');
    case AlertSeverity.Info:
      return t('Info');
    case AlertSeverity.Warning:
      return t('Warning');
    case AlertSeverity.None:
      return t('None');
    default:
      return severity;
  }
};

export const SeverityBadge = memo(
  ({
    severity,
    count,
    isDimmed = false,
  }: {
    severity?: string | null;
    count?: number;
    isDimmed?: boolean;
  }) => {
    const { t } = useTranslation(process.env.I18N_NAMESPACE);

    if (_.isNil(severity)) return null;

    const labelText = count ? count : getSeverityKey(severity, t);
    const { labelStatus, mutedBackgroundColor } = getSeverityColors(severity);
    const style: CSSProperties = isDimmed
      ? ({
          '--pf-v6-c-label--BackgroundColor': mutedBackgroundColor,
          '--pf-v6-c-label--Color': t_global_text_color_subtle.var,
          '--pf-v6-c-label__icon--Color': t_global_icon_color_subtle.var,
        } as CSSProperties)
      : undefined;

    if (severity === AlertSeverity.None) {
      return (
        <Label variant="outline" style={style}>
          <SeverityUndefinedIcon
            color={
              isDimmed
                ? t_global_icon_color_subtle.var
                : t_global_icon_color_severity_undefined_default.var
            }
          />
          &nbsp;
          {labelText}
        </Label>
      );
    }

    return (
      <Label status={labelStatus} style={style}>
        {labelText}
      </Label>
    );
  },
);

SeverityBadge.displayName = 'SeverityBadge';
