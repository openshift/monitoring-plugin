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
  const [activeProject, setActiveProject] = useState<string | null>(null);
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
    if (!activeProject && projectFromUrl) {
      setActiveProject(projectFromUrl);
      return;
    }
    if (persesProjectsLoading) {
      return;
    }
    // If the url and the data is out of sync, follow the data
    if (activeProject) {
      setProject(activeProject);
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
