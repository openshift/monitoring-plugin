import {
  K8sResourceKind,
  useActiveNamespace,
  useK8sWatchResource,
} from '@openshift-console/dynamic-plugin-sdk';
import * as React from 'react';
import { useQueryParams } from '../../../hooks/useQueryParams';
import { LEGACY_DASHBOARDS_KEY } from './utils';
import { ProjectModel } from '../../../console/models';
import { setQueryArgument } from '../../../console/utils/router';

export const useActiveProject = () => {
  const [activeProject, setActiveProject] = React.useState('');
  const [activeNamespace, setActiveNamespace] = useActiveNamespace();
  const queryParams = useQueryParams();
  const [namespaces, namespacesLoaded] = useK8sWatchResource<K8sResourceKind[]>({
    isList: true,
    kind: ProjectModel.kind,
    optional: true,
  });

  // Sync the state and the URL param
  React.useEffect(() => {
    const projectFromUrl = queryParams.get('project');
    // If data and url hasn't been set yet, default to legacy dashboard (for now)
    // TODO: Don't default to legacy
    if (!activeProject && !projectFromUrl) {
      setActiveProject(LEGACY_DASHBOARDS_KEY);
      return;
      // If activeProject isn't set yet, but the url is, then load from url
    } else if (!activeProject && projectFromUrl) {
      setActiveProject(projectFromUrl);
      return;
    }
    // If the url and the data is out of sync, follow the data
    setQueryArgument('project', activeProject);
  }, [queryParams, activeProject]);

  // Sync the activeProject and activeNamespace changes
  React.useEffect(() => {
    if (
      !activeProject ||
      activeProject === LEGACY_DASHBOARDS_KEY ||
      !namespacesLoaded ||
      activeProject === activeNamespace
    ) {
      return;
    }

    // If the project name exists as a namespace, set the active namespace
    if (namespaces.some((namespace) => namespace.metadata.name === activeProject)) {
      setActiveNamespace(activeProject);
    }
  }, [activeNamespace, setActiveNamespace, activeProject, namespaces, namespacesLoaded]);

  return {
    activeProject,
    setActiveProject,
  };
};
