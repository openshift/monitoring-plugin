import { useEffect } from 'react';
import { alertingErrored, alertingLoaded, alertingLoading } from '../../actions/observe';
import { useURLPoll } from './useURLPoll';
import { Silence } from '@openshift-console/dynamic-plugin-sdk';
import * as _ from 'lodash-es';
import { useDispatch } from 'react-redux';
import { getFetchSilenceAlertUrl, usePerspective } from './usePerspective';
import { getSilenceName } from '../utils';

const URL_POLL_DEFAULT_DELAY = 15000; // 15 seconds

export const useSilencesPoller = ({ namespace }) => {
  const { perspective, silencesKey } = usePerspective();
  const url = getFetchSilenceAlertUrl(perspective, namespace);
  const [response, loadError, loading] = useURLPoll<Silence[]>(
    url,
    URL_POLL_DEFAULT_DELAY,
    namespace,
  );
  const dispatch = useDispatch();
  useEffect(() => {
    if (loadError) {
      dispatch(alertingErrored(silencesKey, loadError, perspective));
    } else if (loading) {
      dispatch(alertingLoading(silencesKey, perspective));
    } else {
      _.each(response, (silence: Silence) => {
        silence.name = getSilenceName(silence);
      });
      dispatch(alertingLoaded(silencesKey, response, perspective));
    }
  }, [dispatch, loadError, loading, response, perspective, silencesKey]);
};
