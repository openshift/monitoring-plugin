import { useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import { useCallback, useEffect } from 'react';
import { QueryParams } from '../../query-params';
import { StringParam, useQueryParam } from 'use-query-params';
import { useDispatch, useSelector } from 'react-redux';
import { MonitoringState } from '../../../store/store';
import { getObserveState, usePerspective } from '../../hooks/usePerspective';
import { useMonitoring } from '../../../hooks/useMonitoring';
import { useParams } from 'react-router';
import { dashboardsPatchVariable } from '../../../store/actions';

export const useOpenshiftProject = () => {
  const { perspective } = usePerspective();
  const [activeNamespace, setActiveNamespace] = useActiveNamespace();
  const { ns: routeNamespace } = useParams<{ ns?: string }>();
  const [openshiftProject, setOpenshiftProject] = useQueryParam(
    QueryParams.OpenshiftProject,
    StringParam,
  );
  const { plugin } = useMonitoring();
  const variableNamespace = useSelector(
    (state: MonitoringState) =>
      getObserveState(plugin, state).dashboards.variables['namespace']?.value ?? '',
  );
  const dispatch = useDispatch();

  useEffect(() => {
    if (perspective !== 'dev') {
      if (!openshiftProject) {
        setOpenshiftProject(activeNamespace);
      }
    } else {
      if (routeNamespace && activeNamespace !== routeNamespace) {
        setActiveNamespace(routeNamespace);
      }
      if (variableNamespace && variableNamespace !== routeNamespace) {
        dispatch(
          dashboardsPatchVariable('namespace', {
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
  ]);

  const setProject = useCallback(
    (namespace: string) => {
      if (perspective === 'dev') {
        setActiveNamespace(namespace);
      } else {
        setOpenshiftProject(namespace);
      }
    },
    [setActiveNamespace, setOpenshiftProject, perspective],
  );

  return {
    project: perspective === 'dev' ? routeNamespace || activeNamespace : openshiftProject,
    setProject,
  };
};
