import { useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router';
import { StringParam, useQueryParam } from 'use-query-params';

import { QueryParams } from '@/shared/constants/query-params';
import { useMonitoring } from '@/shared/hooks/useMonitoring';
import { getObserveState, usePerspective } from '@/shared/hooks/usePerspective';
import { dashboardsPatchVariable } from '@/shared/store/actions';
import { MonitoringState } from '@/shared/store/store';

export const useLegacyDashboardsProject = (dashboardName?: string) => {
  const { perspective } = usePerspective();
  const [activeNamespace, setActiveNamespace] = useActiveNamespace();
  const { ns: routeNamespace } = useParams<{ ns?: string }>();
  const [openshiftProject, setOpenshiftProject] = useQueryParam(
    QueryParams.OpenshiftProject,
    StringParam,
  );
  const { plugin } = useMonitoring();
  const variableNamespace = useSelector((state: MonitoringState) =>
    dashboardName
      ? (getObserveState(plugin, state).dashboards.legacy[dashboardName]?.variables['namespace']
          ?.value ?? '')
      : '',
  );
  const dispatch = useDispatch();

  useEffect(() => {
    if (perspective !== 'dev') {
      if (!openshiftProject) {
        setOpenshiftProject(activeNamespace);
      }
    } else {
      if (dashboardName && variableNamespace && variableNamespace !== routeNamespace) {
        dispatch(
          dashboardsPatchVariable(dashboardName, 'namespace', {
            // Dashboards space variable shouldn't use the ALL_NAMESPACES_KEY
            value: routeNamespace,
          }),
        );
      }
    }
  }, [
    activeNamespace,
    setActiveNamespace,
    openshiftProject,
    setOpenshiftProject,
    dispatch,
    variableNamespace,
    perspective,
    routeNamespace,
    dashboardName,
  ]);

  return {
    project: perspective === 'dev' ? routeNamespace || activeNamespace : openshiftProject,
  };
};
