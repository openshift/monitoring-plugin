import {
  K8sResourceKind,
  useActiveNamespace,
  useK8sWatchResource,
} from '@openshift-console/dynamic-plugin-sdk';
import { useEffect } from 'react';
import { ProjectModel } from '../../../console/models';
import { QueryParams } from '../../../query-params';
import { StringParam, useQueryParam } from 'use-query-params';
import { ALL_NAMESPACES_KEY } from '../../../utils';

export const useActiveProject = () => {
  const [activeNamespace, setActiveNamespace] = useActiveNamespace();
  const [projectFromUrl, setProject] = useQueryParam(QueryParams.Project, StringParam);
  const [namespaces, namespacesLoaded] = useK8sWatchResource<K8sResourceKind[]>({
    isList: true,
    kind: ProjectModel.kind,
    optional: true,
  });

  // Sync the activeProject and activeNamespace changes
  useEffect(() => {
    if (!namespacesLoaded || projectFromUrl === activeNamespace) {
      return;
    }

    if (!projectFromUrl) {
      setProject(activeNamespace);
      return;
    }

    // If the project name exists as a namespace, set the active namespace
    if (
      namespaces.some((namespace) => namespace.metadata.name === projectFromUrl) ||
      projectFromUrl === ALL_NAMESPACES_KEY
    ) {
      setActiveNamespace(projectFromUrl);
    }
  }, [
    activeNamespace,
    setActiveNamespace,
    namespaces,
    namespacesLoaded,
    projectFromUrl,
    setProject,
  ]);

  return {
    activeProject: projectFromUrl,
    setActiveProject: setProject,
  };
};
