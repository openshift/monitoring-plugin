import { Silence, SilenceStates, useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import { Alert } from '@patternfly/react-core';
import * as _ from 'lodash-es';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom-v5-compat';
import { MonitoringState } from '../../store/store';
import { StatusBox } from '../console/console-shared/src/components/status/StatusBox';
import { getObserveState } from '../hooks/usePerspective';
import { Silences } from '../types';
import { SilenceResource, silenceState } from '../utils';
import { SilenceForm } from './SilenceForm';
import { MonitoringContext, MonitoringProvider } from '../../contexts/MonitoringContext';
import { useAlerts } from '../../hooks/useAlerts';

const pad = (i: number): string => (i < 10 ? `0${i}` : String(i));

const formatDate = (d: Date): string =>
  `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}:${pad(d.getSeconds())}`;

const EditInfo = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Alert isInline title={t('Overwriting current silence')} variant="info">
      {t(
        'When changes are saved, the currently existing silence will be expired and a new silence with the new configuration will take its place.',
      )}
    </Alert>
  );
};

const SilenceEditPage = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { plugin } = useContext(MonitoringContext);
  const params = useParams();
  const [namespace] = useActiveNamespace();

  useAlerts();

  const silences = useSelector(
    (state: MonitoringState) =>
      getObserveState(plugin, state)
        ?.get('alerting')
        ?.get(namespace)
        ?.get('silences')
        ?.toJS() as Silences,
  );

  const silence: Silence = _.find(silences?.data, { id: params.id });
  const isExpired = silenceState(silence) === SilenceStates.Expired;
  const defaults = _.pick(silence, [
    'comment',
    'createdBy',
    'endsAt',
    'id',
    'matchers',
    'startsAt',
  ]);
  defaults.startsAt = isExpired ? undefined : formatDate(new Date(defaults.startsAt));
  defaults.endsAt = isExpired ? undefined : formatDate(new Date(defaults.endsAt));

  return (
    <StatusBox
      data={silence}
      label={SilenceResource.label}
      loaded={silences?.loaded}
      loadError={silences?.loadError}
    >
      <SilenceForm
        defaults={defaults}
        Info={isExpired ? undefined : EditInfo}
        title={isExpired ? t('Recreate silence') : t('Edit silence')}
      />
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
