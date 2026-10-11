import { AlertSeverity } from '@openshift-console/dynamic-plugin-sdk';
import { Label } from '@patternfly/react-core';
import {
  RhUiErrorFillIcon,
  RhUiInformationFillIcon,
  RhUiWarningFillIcon,
  SeverityUndefinedIcon,
} from '@patternfly/react-icons';
import { t_global_icon_color_severity_undefined_default } from '@patternfly/react-tokens';
import * as _ from 'lodash-es';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

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
  ({ severity, count }: { severity?: string | null; count?: number }) => {
    const { t } = useTranslation(process.env.I18N_NAMESPACE);

    if (_.isNil(severity)) return null;

    const labelText = count ? count : getSeverityKey(severity, t);
    switch (severity) {
      case AlertSeverity.Critical:
        return <Label status="danger">{labelText}</Label>;
      case AlertSeverity.Warning:
        return <Label status="warning">{labelText}</Label>;
      case AlertSeverity.Info:
        return <Label status="info">{labelText}</Label>;
      case AlertSeverity.None:
        return (
          <Label variant="outline">
            <SeverityUndefinedIcon color={t_global_icon_color_severity_undefined_default.var} />
            &nbsp;
            {labelText}
          </Label>
        );
      default:
        return <Label status="custom">{labelText}</Label>;
    }
  },
);

SeverityBadge.displayName = 'SeverityBadge';
