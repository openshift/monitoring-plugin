import * as React from 'react';
import { alertingErrored, alertingLoaded, alertingLoading } from '../../actions/observe';
import { useURLPoll } from './useURLPoll';
import { Silence } from '@openshift-console/dynamic-plugin-sdk';
import * as _ from 'lodash-es';
import { useDispatch } from 'react-redux';
import { usePerspective } from './usePerspective';
import { getSilenceName } from '../utils';
import { fetchSilenceAlertURL } from '../alerting/SilencesUtils';

const URL_POLL_DEFAULT_DELAY = 15000; // 15 seconds

export const useSilencesPoller = ({ namespace }) => {
  const { isDev } = usePerspective();
  const { alertManagerBaseURL } = window.SERVER_FLAGS;
  const url = fetchSilenceAlertURL(isDev, alertManagerBaseURL, namespace);
  const [response, loadError, loading] = useURLPoll<Silence[]>(
    url,
    URL_POLL_DEFAULT_DELAY,
    namespace,
  );
  const dispatch = useDispatch();
  React.useEffect(() => {
    if (loadError) {
      dispatch(alertingErrored('devSilences', loadError, 'dev'));
    } else if (loading) {
      dispatch(alertingLoading('devSilences', 'dev'));
    } else {
      _.each(response, (silence: Silence) => {
        silence.name = getSilenceName(silence);
      });
      dispatch(alertingLoaded('devSilences', response, 'dev'));
    }
  }, [dispatch, loadError, loading, response, isDev]);
};
