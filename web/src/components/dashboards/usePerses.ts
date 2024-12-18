import { PERSES_BASE_URL, PersesDashboardMetadata } from './perses-client';
import { useCallback, useEffect, useReducer } from 'react';
import { useURLPoll } from '@openshift-console/dynamic-plugin-sdk-internal';
import { useSafeFetch } from '../console/utils/safe-fetch-hook';
import { usePoll } from '../console/utils/poll-hook';

export enum POLL_DELAY {
  tenSeconds = 10000,
  none = null,
}

type State = {
  dashboardsData: PersesDashboardMetadata[];
  isLoadingDashboardsData: boolean;
  dashboardsError: unknown;
  pollDelay: POLL_DELAY;
};

type Action =
  | {
      type: 'dashboardsMetadataResponse';
      payload: { dashboardsData: PersesDashboardMetadata[] };
    }
  | {
      type: 'dashboardsLoading';
    }
  | {
      type: 'dashboardsError';
      payload: { error: unknown };
    }
  | {
      type: 'updatePollDelay';
      payload: { delay: POLL_DELAY };
    };

const reducer = (state: State, action: Action): State => {
  console.log({ action });
  switch (action.type) {
    case 'dashboardsMetadataResponse':
      return {
        ...state,
        isLoadingDashboardsData: false,
        dashboardsData: action.payload.dashboardsData,
      };
    case 'dashboardsError':
      return {
        ...state,
        isLoadingDashboardsData: false,
        dashboardsError: action.payload.error,
      };
    case 'dashboardsLoading':
      return {
        ...state,
        isLoadingDashboardsData: true,
        dashboardsData: undefined,
        dashboardsError: undefined,
      };
    case 'updatePollDelay':
      return {
        ...state,
        pollDelay: action.payload.delay,
      };
    default:
      return state;
  }
};

export const usePerses = () => {
  const initialState = {
    dashboardsData: undefined,
    isLoadingDashboardsData: false,
    dashboardsError: undefined,
    pollDelay: POLL_DELAY.none,
  };
  const listDashboardsMetadataEndpoint = '/api/v1/dashboards?metadata_only=true';
  const persesDashboardsUrl = `${PERSES_BASE_URL}${listDashboardsMetadataEndpoint}`;

  const [state, dispatch] = useReducer(reducer, initialState);
  const { dashboardsData, isLoadingDashboardsData, dashboardsError, pollDelay } = state;

  const changePollDelay = useCallback(
    (delayTime) => {
      if (pollDelay !== delayTime) {
        dispatch({ type: 'updatePollDelay', payload: { delay: delayTime } });
      }
    },
    [dispatch, pollDelay],
  );

  const usePersesDashboardsPoller = () => {
    const [response, loadError, loading] = useURLPoll<PersesDashboardMetadata[]>(
      persesDashboardsUrl,
      pollDelay,
    );

    console.log('1. usePersesDashboardsPoller: ', { response, pollDelay });

    useEffect(() => {
      if (loadError) {
        dispatch({ type: 'dashboardsError', payload: { error: loadError } });
      } else if (loading) {
        dispatch({ type: 'dashboardsLoading' });
      } else {
        dispatch({
          type: 'dashboardsMetadataResponse',
          payload: { dashboardsData: response },
        });
      }
    }, [loadError, loading, response]);
  };
  usePersesDashboardsPoller();

  // // eslint-disable-next-line react-hooks/exhaustive-deps
  // const safeFetch = useCallback(useSafeFetch(), []);
  // const tick = () => {
  //   safeFetch(persesDashboardsUrl)
  //     .then((response) => {
  //       dispatch({
  //         type: 'dashboardsMetadataResponse',
  //         payload: { dashboardsData: response },
  //       });
  //       dispatch({ type: 'dashboardsError', payload: { error: undefined } });
  //     })
  //     .catch((error) => {
  //       dispatch({
  //         type: 'dashboardsMetadataResponse',
  //         payload: { dashboardsData: undefined },
  //       });
  //       dispatch({ type: 'dashboardsError', payload: { error } });
  //     });
  // };
  // usePoll(tick, pollDelay);

  return {
    dashboardsData,
    isLoadingDashboardsData,
    dashboardsError,
    changePollDelay,
    pollDelay,
  };
};
