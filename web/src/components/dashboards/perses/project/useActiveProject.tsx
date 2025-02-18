import {
  K8sResourceKind,
  useActiveNamespace,
  useK8sWatchResource,
} from '@openshift-console/dynamic-plugin-sdk';
import * as React from 'react';
import { useQueryParams } from '../../../hooks/useQueryParams';
import { ProjectModel } from '../../../console/models';
import { setQueryArgument } from '../../../console/utils/router';
import { usePerspective } from '../../../hooks/usePerspective';
import { usePerses } from '../hooks/usePerses';
import { QueryParams } from '../../../query-params';

export const useActiveProject = () => {
  const [activeProject, setActiveProject] = React.useState('');
  const [activeNamespace, setActiveNamespace] = useActiveNamespace();
  const { perspective } = usePerspective();
  const { persesProjects, persesProjectsLoading } = usePerses();
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
    if (!activeProject && projectFromUrl) {
      setActiveProject(projectFromUrl);
      return;
    }
    if (persesProjectsLoading) {
      return;
    }
    if (!activeProject && !projectFromUrl) {
      // set to first project
      setActiveProject(persesProjects[0]?.metadata?.name);
      return;
      // If activeProject isn't set yet, but the url is, then load from url
    }
    if (perspective !== 'dev') {
      // If the url and the data is out of sync, follow the data
      setQueryArgument(QueryParams.Project, activeProject);
      // Don't set project in dev perspective since perses dashboards
      // aren't supported there yet
    }
  }, [queryParams, activeProject, perspective, persesProjects, persesProjectsLoading]);

  // Sync the activeProject and activeNamespace changes
  React.useEffect(() => {
    if (!activeProject || !namespacesLoaded || activeProject === activeNamespace) {
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
