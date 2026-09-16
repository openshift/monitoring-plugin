import { useMemo } from 'react';
import { useOcpProjects } from './useOcpProjects';

export const useEditableProjects = () => {
  const { ocpProjects } = useOcpProjects();
  const allProjects = useMemo(
    () =>
      ocpProjects
        .map((project) => project.metadata?.name)
        .filter((project): project is string => !!project)
        .sort((a, b) => a.localeCompare(b)),
    [ocpProjects],
  );

  return {
    editableProjects: allProjects,
    allProjects,
    hasEditableProject: allProjects.length > 0,
    permissionsLoading: false,
    permissionsError: undefined,
  };
};
