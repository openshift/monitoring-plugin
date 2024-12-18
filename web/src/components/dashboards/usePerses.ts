import { PERSES_BASE_URL, PersesDashboardMetadata } from './perses-client';
import { useCallback, useEffect, useReducer } from 'react';
import { useURLPoll } from '@openshift-console/dynamic-plugin-sdk-internal';

export enum POLL_DELAY {
  tenSeconds = 10000,
  oneHour = 3600000,
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
      type: 'dashboardsRequest';
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
    case 'dashboardsRequest':
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
    pollDelay: POLL_DELAY.oneHour,
  };

  const [state, dispatch] = useReducer(reducer, initialState);

  const { dashboardsData, isLoadingDashboardsData, dashboardsError, pollDelay } = state;

  // const changePollDelay = (delayTime: POLL_DELAY) => {
  //   dispatch({ type: 'updatePollDelay', payload: { delay: delayTime } });

  //   console.log('USEPERSESE > CHANGEPOLLDELAY', delayTime);
  // };

  const changePollDelay = useCallback(
    (delayTime) => {
      if (pollDelay !== delayTime) {
        dispatch({ type: 'updatePollDelay', payload: { delay: delayTime } });
      }
    },
    [dispatch, pollDelay],
  );

  const usePersesDashboardsPoller = () => {
    const listDashboardsMetadata = '/api/v1/dashboards?metadata_only=true';
    const persesURL = `${PERSES_BASE_URL}${listDashboardsMetadata}`;

    const [response, loadError, loading] = useURLPoll<PersesDashboardMetadata[]>(
      persesURL,
      pollDelay,
    );

    console.log('1. usePersesDashboardsPoller: ', { response, pollDelay });

    useEffect(() => {
      if (loadError) {
        dispatch({ type: 'dashboardsError', payload: { error: loadError } });
      } else if (loading) {
        dispatch({ type: 'dashboardsRequest' });
      } else {
        dispatch({
          type: 'dashboardsMetadataResponse',
          payload: { dashboardsData: response },
        });
      }
    }, [loadError, loading, response]);
  };

  usePersesDashboardsPoller();

  return {
    dashboardsData,
    isLoadingDashboardsData,
    dashboardsError,
    changePollDelay,
    pollDelay,
  };
};
