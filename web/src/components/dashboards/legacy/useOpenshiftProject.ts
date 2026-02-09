import { useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import { useCallback, useEffect } from 'react';
import { QueryParams } from '../../query-params';
import { StringParam, useQueryParam } from 'use-query-params';
import { useDispatch, useSelector } from 'react-redux';
import { dashboardsPatchVariable } from '../../../store/actions';
import { MonitoringState } from '../../../store/store';
import { getObserveState } from '../../hooks/usePerspective';
import { useMonitoring } from '../../../hooks/useMonitoring';
import { ALL_NAMESPACES_KEY } from '../../utils';

export const useOpenshiftProject = () => {
  const [activeNamespace, setActiveNamespace] = useActiveNamespace();
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
    // If the URL parameter is set, but the activeNamespace doesn't match it, then
    // set the activeNamespace to match the URL parameter
    if (openshiftProject && openshiftProject !== activeNamespace) {
      setActiveNamespace(openshiftProject);
      if (variableNamespace !== openshiftProject && openshiftProject !== ALL_NAMESPACES_KEY) {
        dispatch(
          dashboardsPatchVariable('namespace', {
            // Dashboards space variable shouldn't use the ALL_NAMESPACES_KEY
            value: openshiftProject,
          }),
        );
      }
      return;
    }
    if (!openshiftProject) {
      setOpenshiftProject(activeNamespace);
      if (variableNamespace !== activeNamespace && openshiftProject !== ALL_NAMESPACES_KEY) {
        // Dashboards space variable shouldn't use the ALL_NAMESPACES_KEY
        dispatch(
          dashboardsPatchVariable('namespace', {
            value: activeNamespace,
          }),
        );
      }
      return;
    }
  }, [
    activeNamespace,
    setActiveNamespace,
    openshiftProject,
    setOpenshiftProject,
    dispatch,
    variableNamespace,
  ]);

  const setProject = useCallback(
    (namespace: string) => {
      setActiveNamespace(namespace);
      setOpenshiftProject(namespace);
      dispatch(dashboardsPatchVariable('namespace', { value: namespace }));
    },
    [setActiveNamespace, setOpenshiftProject, dispatch],
  );

  return {
    project: openshiftProject,
    setProject,
  };
};
