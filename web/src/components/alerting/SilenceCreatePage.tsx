import * as _ from 'lodash-es';
import { useTranslation } from 'react-i18next';
import { getAllQueryArguments } from '../console/utils/router';
import { SilenceForm } from './SilenceForm';
import { MonitoringProvider } from '../../contexts/MonitoringContext';
import { useMonitoring } from '../../hooks/useMonitoring';
import { LoadingBox } from '../console/console-shared/src/components/loading/LoadingBox';
import { useQueryNamespace } from '../hooks/useQueryNamespace';

const CreateSilencePage = () => {
  const { accessCheckLoading, useAlertsTenancy } = useMonitoring();
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  // Set the activeNamespace to be the namespace query parameter if it is set
  useQueryNamespace();

  const matchers = _.map(getAllQueryArguments(), (value, name) => ({
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
