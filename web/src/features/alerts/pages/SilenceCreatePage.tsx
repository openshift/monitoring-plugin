import * as _ from 'lodash-es';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { SilenceForm } from '@/features/alerts/components/SilenceForm';
import { LoadingBox } from '@/shared/console/console-shared/src/components/loading/LoadingBox';
import { MonitoringProvider } from '@/shared/contexts/MonitoringContext';
import { useMonitoring } from '@/shared/hooks/useMonitoring';
import { useMonitoringNamespace } from '@/shared/hooks/useMonitoringNamespace';

const CreateSilencePage = () => {
  const { accessCheckLoading, useAlertsTenancy } = useMonitoring();
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [queryParams] = useSearchParams();

  // Set the activeNamespace to be the namespace query parameter if it is set
  useMonitoringNamespace();

  const matchers = _.map(Object.fromEntries(queryParams), (value, name) => ({
    name,
    value,
    isRegex: false,
  }));

  if (accessCheckLoading) {
    return <LoadingBox />;
  }

  return _.isEmpty(matchers) ? (
    <SilenceForm defaults={{}} title={t('Create silence')} isNamespaced={useAlertsTenancy} />
  ) : (
    <SilenceForm
      defaults={{ matchers }}
      title={t('Silence alert')}
      isNamespaced={useAlertsTenancy}
    />
  );
};

export const MpCmoCreateSilencePage = () => {
  return (
    <MonitoringProvider monitoringContext={{ plugin: 'monitoring-plugin', prometheus: 'cmo' }}>
      <CreateSilencePage />
    </MonitoringProvider>
  );
};

export const McpAcmCreateSilencePage = () => {
  return (
    <MonitoringProvider
      monitoringContext={{ plugin: 'monitoring-console-plugin', prometheus: 'acm' }}
    >
      <CreateSilencePage />
    </MonitoringProvider>
  );
};
