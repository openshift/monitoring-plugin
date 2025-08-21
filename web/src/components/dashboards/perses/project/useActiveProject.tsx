import {
  K8sResourceKind,
  useActiveNamespace,
  useK8sWatchResource,
} from '@openshift-console/dynamic-plugin-sdk';
import { useState, useEffect } from 'react';
import { ProjectModel } from '../../../console/models';
import { usePerspective } from '../../../hooks/usePerspective';
import { usePerses } from '../hooks/usePerses';
import { QueryParams } from '../../../query-params';
import { StringParam, useQueryParam } from 'use-query-params';

export const useActiveProject = () => {
  const [activeProject, setActiveProject] = useState('');
  const [activeNamespace, setActiveNamespace] = useActiveNamespace();
  const { perspective } = usePerspective();
  const { persesProjects, persesProjectsLoading } = usePerses();
  const [projectFromUrl, setProject] = useQueryParam(QueryParams.Project, StringParam);
  const [namespaces, namespacesLoaded] = useK8sWatchResource<K8sResourceKind[]>({
    isList: true,
    kind: ProjectModel.kind,
    optional: true,
  });

  // Sync the state and the URL param
  useEffect(() => {
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
      setProject(activeProject);
      // Don't set project in dev perspective since perses dashboards
      // aren't supported there yet
    }
  }, [
    projectFromUrl,
    activeProject,
    perspective,
    persesProjects,
    persesProjectsLoading,
    setProject,
  ]);

  // Sync the activeProject and activeNamespace changes
  useEffect(() => {
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
