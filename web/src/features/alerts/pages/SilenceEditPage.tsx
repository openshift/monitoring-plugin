import { Silence, SilenceStates } from '@openshift-console/dynamic-plugin-sdk';
import * as _ from 'lodash-es';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { LegacySilenceForm } from '@/features/alerts/components/LegacySilenceForm';
import { SilenceEditInfo } from '@/shared/components/silences/SilenceEditInfo';
import { StatusBox } from '@/shared/console/console-shared/src/components/status/StatusBox';
import { MonitoringProvider } from '@/shared/contexts/MonitoringContext';
import { useAlerts } from '@/shared/hooks/useAlerts';
import { useMonitoring } from '@/shared/hooks/useMonitoring';
import { silenceState } from '@/shared/utils/alerts/formatting';
import { getSilenceFormDefaults } from '@/shared/utils/alerts/get-silence-form-defaults';
import { SilenceResource } from '@/shared/utils/utils';

const SilenceEditPage = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { accessCheckLoading, useAlertsTenancy } = useMonitoring();
  const params = useParams();

  const { silences } = useAlerts();

  const silence: Silence = _.find(silences?.data, { id: params.id });
  const isExpired = silenceState(silence) === SilenceStates.Expired;

  return (
    <StatusBox
      data={silence}
      label={SilenceResource.label}
      loaded={silences?.loaded && !accessCheckLoading}
      loadError={silences?.loadError}
    >
      {silence && (
        <LegacySilenceForm
          defaults={getSilenceFormDefaults(silence)}
          Info={isExpired ? undefined : SilenceEditInfo}
          title={isExpired ? t('Recreate silence') : t('Edit silence')}
          isNamespaced={useAlertsTenancy}
        />
      )}
    </StatusBox>
  );
};

export const MpCmoSilenceEditPage = () => {
  return (
    <MonitoringProvider monitoringContext={{ plugin: 'monitoring-plugin', prometheus: 'cmo' }}>
      <SilenceEditPage />
    </MonitoringProvider>
  );
};

export const McpAcmSilenceEditPage = () => {
  return (
    <MonitoringProvider
      monitoringContext={{ plugin: 'monitoring-console-plugin', prometheus: 'acm' }}
    >
      <SilenceEditPage />
    </MonitoringProvider>
  );
};
