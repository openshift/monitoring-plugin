import type { FC } from 'react';
import { useNavigate } from 'react-router';

import { SilenceFormContent } from '@/shared/components/silences/SilenceForm';
import type { SilenceFormProps } from '@/shared/components/silences/SilenceForm';
import withFallback from '@/shared/console/console-shared/error/fallbacks/WithFallback';
import { useAlerts } from '@/shared/hooks/useAlerts';
import { useMonitoringNamespace } from '@/shared/hooks/useMonitoringNamespace';
import { getSilenceAlertUrl, usePerspective } from '@/shared/hooks/usePerspective';

type LegacySilenceFormProps = Omit<SilenceFormProps, 'onSuccess' | 'onCancel'>;

const LegacySilenceFormWithData: FC<LegacySilenceFormProps> = (props) => {
  const { trigger: refreshSilenceData } = useAlerts();
  const navigate = useNavigate();
  const { perspective } = usePerspective();
  const { namespace } = useMonitoringNamespace();

  return (
    <SilenceFormContent
      {...props}
      onSuccess={(silenceID) => {
        refreshSilenceData();
        navigate(getSilenceAlertUrl(perspective, silenceID, namespace));
      }}
      onCancel={() => navigate(-1)}
    />
  );
};

export const LegacySilenceForm = withFallback(LegacySilenceFormWithData);
