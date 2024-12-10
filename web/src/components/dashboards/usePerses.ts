import { PERSES_BASE_URL, PersesDashboardMetadata } from './perses-client';
import { useEffect, useReducer } from 'react';
import { useURLPoll } from '@openshift-console/dynamic-plugin-sdk-internal';

type State = {
  dashboardsData: PersesDashboardMetadata[];
  isLoadingDashboardsData: boolean;
  dashboardsError: unknown;
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
    };

const reducer = (state: State, action: Action): State => {
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
    default:
      return state;
  }
};

const URL_POLL_DEFAULT_DELAY = 15000; // 15 seconds

export const usePerses = () => {
  const initialState = {
    dashboardsData: undefined,
    isLoadingDashboardsData: false,
    dashboardsError: undefined,
  };

  const [state, dispatch] = useReducer(reducer, initialState);

  const { dashboardsData, isLoadingDashboardsData, dashboardsError } = state;

  const usePersesDashboardsPoller = () => {
    const listDashboardsMetadata = '/api/v1/dashboards?metadata_only=true';
    const persesURL = `${PERSES_BASE_URL}${listDashboardsMetadata}`;

    const [response, loadError, loading] = useURLPoll<PersesDashboardMetadata[]>(
      persesURL,
      URL_POLL_DEFAULT_DELAY,
    );

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

  return {
    usePersesDashboardsPoller,
    dashboardsData,
    isLoadingDashboardsData,
    dashboardsError,
  };
};
