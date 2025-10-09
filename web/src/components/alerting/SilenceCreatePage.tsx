import * as _ from 'lodash-es';
import { useTranslation } from 'react-i18next';
import { getAllQueryArguments } from '../console/utils/router';
import { SilenceForm } from './SilenceForm';
import { MonitoringProvider } from '../../contexts/MonitoringContext';
import { ALL_NAMESPACES_KEY } from '../utils';
import { useQueryNamespace } from '../hooks/useQueryNamespace';

const CreateSilencePage = ({ isNamespaced }: { isNamespaced: boolean }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const matchers = _.map(getAllQueryArguments(), (value, name) => ({
    name,
    value,
    isRegex: false,
  }));

  return _.isEmpty(matchers) ? (
    <SilenceForm defaults={{}} title={t('Create silence')} isNamespaced={isNamespaced} />
  ) : (
    <SilenceForm defaults={{ matchers }} title={t('Silence alert')} isNamespaced={isNamespaced} />
  );
};

export const MpCmoCreateSilencePage = () => {
  const { namespace } = useQueryNamespace();

  return (
    <MonitoringProvider monitoringContext={{ plugin: 'monitoring-plugin', prometheus: 'cmo' }}>
      <CreateSilencePage isNamespaced={namespace !== ALL_NAMESPACES_KEY} />
    </MonitoringProvider>
  );
};

export const McpAcmCreateSilencePage = () => {
  return (
    <MonitoringProvider
      monitoringContext={{ plugin: 'monitoring-console-plugin', prometheus: 'acm' }}
    >
      <CreateSilencePage isNamespaced={false} />
    </MonitoringProvider>
  );
};
