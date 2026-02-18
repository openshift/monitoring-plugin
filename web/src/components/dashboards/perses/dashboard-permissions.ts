import { checkAccess } from '@openshift-console/dynamic-plugin-sdk';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

const checkProjectPermissions = async (projects: any[]): Promise<string[]> => {
  if (!projects || projects.length === 0) {
    return [];
  }

  const editableProjectNames: string[] = [];

  for (const project of projects) {
    const projectName = project?.metadata?.name;
    if (!projectName) continue;

    try {
      const [createResult, updateResult, deleteResult] = await Promise.all([
        checkAccess({
          group: 'perses.dev',
          resource: 'persesdashboards',
          verb: 'create',
          namespace: projectName,
        }),
        checkAccess({
          group: 'perses.dev',
          resource: 'persesdashboards',
          verb: 'update',
          namespace: projectName,
        }),
        checkAccess({
          group: 'perses.dev',
          resource: 'persesdashboards',
          verb: 'delete',
          namespace: projectName,
        }),
      ]);

      const canEdit =
        createResult?.status?.allowed &&
        updateResult?.status?.allowed &&
        deleteResult?.status?.allowed;

      if (canEdit) {
        editableProjectNames.push(projectName);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`Failed to check permissions for project ${projectName}:`, error);
    }
  }

  return editableProjectNames;
};

export const useProjectPermissions = (projects: any[]) => {
  const queryKey = useMemo(() => {
    if (!projects || projects.length === 0) {
      return ['project-permissions', 'empty'];
    }

    const projectFingerprint = projects.map((p) => ({
      name: p?.metadata?.name,
      version: p?.metadata?.version,
      updatedAt: p?.metadata?.updatedAt,
    }));

    return ['project-permissions', JSON.stringify(projectFingerprint)];
  }, [projects]);

  const {
    data: editableProjects = [],
    isLoading: loading,
    error,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        return await checkProjectPermissions(projects);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Failed to check project permissions:', error);
        return [];
      }
    },
    enabled: !!projects && projects.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const hasEditableProject = editableProjects.length > 0;

  return { editableProjects, hasEditableProject, loading, error };
};
