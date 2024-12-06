import { PersesDashboardMetadata } from './perses-client';
import { useCallback, useReducer, useRef } from 'react';
import { fetchPersesDashboardsMetadata } from './perses-client';

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError';

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

export const usePerses = () => {
  const dashboardsAbort = useRef<() => void | undefined>();

  const initialState = {
    dashboardsData: undefined,
    isLoadingDashboardsData: false,
    dashboardsError: undefined,
  };

  const [state, dispatch] = useReducer(reducer, initialState);

  const { dashboardsData, isLoadingDashboardsData, dashboardsError } = state;

  /**
   * Lists perses dashboards meta data only (no dashboards specs)
   */
  const getPersesDashboards = useCallback(async () => {
    try {
      if (dashboardsAbort.current) {
        dashboardsAbort.current();
      }

      dispatch({ type: 'dashboardsRequest' });

      const { request, abort } = fetchPersesDashboardsMetadata();
      dashboardsAbort.current = abort;

      const response = await request();

      dispatch({
        type: 'dashboardsMetadataResponse',
        payload: { dashboardsData: response },
      });
    } catch (error) {
      if (!isAbortError(error)) {
        dispatch({ type: 'dashboardsError', payload: { error } });
      }
    }
  }, []);

  return {
    getPersesDashboards,
    dashboardsData,
    isLoadingDashboardsData,
    dashboardsError,
  };
};
