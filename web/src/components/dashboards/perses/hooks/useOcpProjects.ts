import { useMemo } from 'react';
import { K8sResourceKind, useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { ProjectModel } from '../../../console/models';

export const useOcpProjects = () => {
  const [ocpProjects, ocpProjectsLoaded] = useK8sWatchResource<K8sResourceKind[]>({
    isList: true,
    kind: ProjectModel.kind,
    optional: true,
  });

  const memoizedOcpProjects = useMemo(() => {
    return ocpProjects || [];
  }, [ocpProjects]);

  const result = useMemo(
    () => ({
      ocpProjects: memoizedOcpProjects,
      ocpProjectsLoaded,
    }),
    [memoizedOcpProjects, ocpProjectsLoaded],
  );

  return result;
};
