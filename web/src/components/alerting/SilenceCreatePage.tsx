import * as _ from 'lodash-es';
import { useTranslation } from 'react-i18next';
import { getAllQueryArguments } from '../console/utils/router';
import { SilenceForm } from './SilenceForm';
import { MonitoringProvider } from '../../contexts/MonitoringContext';
import { useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import { ALL_NAMESPACES_KEY } from '../utils';

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
  const [activeNamespace] = useActiveNamespace();

  return (
    <MonitoringProvider monitoringContext={{ plugin: 'monitoring-plugin', prometheus: 'cmo' }}>
      <CreateSilencePage isNamespaced={activeNamespace !== ALL_NAMESPACES_KEY} />
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
