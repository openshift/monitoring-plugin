import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { PersesUserPermissions, useFetchPersesPermissions } from '../perses-client';
import { useOcpProjects } from './useOcpProjects';
import { K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';

interface Projects {
  editableProjects: string[] | undefined;
  allProjects: string[] | undefined;
}

const useUsername = (): string => {
  const getUser = (state: any) => state.sdkCore?.user;
  const user = useSelector(getUser);
  return user?.metadata?.name || user?.username;
};

const combinePersesAndOcpProjects = (
  persesUserPermissions: PersesUserPermissions,
  ocpProjects: K8sResourceKind[],
): string[] => {
  const persesProjectNames = Object.keys(persesUserPermissions).filter((name) => name !== '*');
  const allAvailableProjects = new Set<string>([...persesProjectNames]);
  ocpProjects.forEach((project) => {
    if (project.metadata?.name) {
      allAvailableProjects.add(project.metadata.name);
    }
  });
  return Array.from(allAvailableProjects);
};

const getEditableProjects = (
  persesUserPermissions: PersesUserPermissions,
  allAvailableProjects: string[],
): string[] => {
  const editableProjectNames = new Set<string>();
  Object.entries(persesUserPermissions).forEach(([projectName, permissions]) => {
    const hasDashboardPermissions = permissions.some((permission) => {
      const allActions = permission.actions.includes('*');
      const individualActions =
        permission.actions.includes('create') &&
        permission.actions.includes('update') &&
        permission.actions.includes('delete');
      const hasPermission =
        permission.scopes.includes('Dashboard') && (individualActions || allActions);
      return hasPermission;
    });

    if (hasDashboardPermissions) {
      if (projectName === '*') {
        allAvailableProjects.forEach((p) => editableProjectNames.add(p));
      } else {
        editableProjectNames.add(projectName);
      }
    }
  });
  return Array.from(editableProjectNames);
};

export const useEditableProjects = () => {
  const username = useUsername();
  const { ocpProjects } = useOcpProjects();

  const { persesUserPermissions, persesPermissionsLoading, persesPermissionsError } =
    useFetchPersesPermissions(username);

  const { editableProjects, allProjects }: Projects = useMemo(() => {
    if (persesPermissionsLoading) {
      return {
        editableProjects: undefined,
        allProjects: undefined,
      };
    }
    if (!persesUserPermissions) {
      return {
        editableProjects: undefined,
        allProjects: undefined,
      };
    }
    if (persesPermissionsError) {
      return {
        editableProjects: undefined,
        allProjects: undefined,
      };
    }

    const allAvailableProjects = combinePersesAndOcpProjects(persesUserPermissions, ocpProjects);
    const editableProjectNames = getEditableProjects(persesUserPermissions, allAvailableProjects);

    // Sort projects alphabetically
    const sortedEditableProjects = editableProjectNames.sort();
    const sortedProjects = allAvailableProjects.sort((a, b) => a.localeCompare(b));

    return {
      editableProjects: sortedEditableProjects,
      allProjects: sortedProjects,
    };
  }, [persesPermissionsLoading, persesUserPermissions, persesPermissionsError, ocpProjects]);

  const hasEditableProject = useMemo(() => {
    return editableProjects ? editableProjects.length > 0 : false;
  }, [editableProjects]);

  return {
    editableProjects,
    allProjects,
    hasEditableProject,
    permissionsLoading: persesPermissionsLoading,
    permissionsError: persesPermissionsError,
  };
};
