import * as _ from 'lodash-es';
import { useTranslation } from 'react-i18next';
import { getAllQueryArguments } from '../console/utils/router';
import { SilenceForm } from './SilenceForm';
import { MonitoringProvider } from '../../contexts/MonitoringContext';
import { ALL_NAMESPACES_KEY } from '../utils';
import { useQueryNamespace } from '../hooks/useQueryNamespace';
import { useMonitoring } from '../../hooks/useMonitoring';

const CreateSilencePage = ({ allowNamespace }: { allowNamespace: boolean }) => {
  const { namespace } = useQueryNamespace();
  const { useAlertsTenancy } = useMonitoring();
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const matchers = _.map(getAllQueryArguments(), (value, name) => ({
    name,
    value,
    isRegex: false,
  }));

  const isNamespaced = allowNamespace && useAlertsTenancy && namespace !== ALL_NAMESPACES_KEY;

  return _.isEmpty(matchers) ? (
    <SilenceForm defaults={{}} title={t('Create silence')} isNamespaced={isNamespaced} />
  ) : (
    <SilenceForm defaults={{ matchers }} title={t('Silence alert')} isNamespaced={isNamespaced} />
  );
};

export const MpCmoCreateSilencePage = () => {
  return (
    <MonitoringProvider monitoringContext={{ plugin: 'monitoring-plugin', prometheus: 'cmo' }}>
      <CreateSilencePage allowNamespace={true} />
    </MonitoringProvider>
  );
};

export const McpAcmCreateSilencePage = () => {
  return (
    <MonitoringProvider
      monitoringContext={{ plugin: 'monitoring-console-plugin', prometheus: 'acm' }}
    >
      <CreateSilencePage allowNamespace={false} />
    </MonitoringProvider>
  );
};
