import { Silence, SilenceStates } from '@openshift-console/dynamic-plugin-sdk';
import { Alert } from '@patternfly/react-core';
import * as _ from 'lodash-es';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom-v5-compat';
import { MonitoringState } from '../../reducers/observe';
import { StatusBox } from '../console/console-shared/src/components/status/StatusBox';
import { useAlertsPoller } from '../hooks/useAlertsPoller';
import { getLegacyObserveState, usePerspective } from '../hooks/usePerspective';
import { Silences } from '../types';
import { SilenceResource, silenceState } from '../utils';
import { SilenceForm } from './SilenceForm';

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

export const SilenceEditPage = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { silencesKey, perspective } = usePerspective();
  const params = useParams();

  useAlertsPoller();

  const silences: Silences = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.get(silencesKey),
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

export default SilenceEditPage;
