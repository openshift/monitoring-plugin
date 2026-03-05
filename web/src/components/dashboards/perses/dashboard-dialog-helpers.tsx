import React from 'react';
import {
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  SelectOptionProps,
  Spinner,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { Controller, Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom-v5-compat';
import { useEditableProjects } from './hooks/useEditableProjects';
import { usePerses } from './hooks/usePerses';
import { useCreateProjectMutation } from './dashboard-api';
import { TypeaheadSelect } from '../../TypeaheadSelect';
import { formGroupStyle, LabelSpacer } from './dashboard-action-modals';
import { useToast } from './ToastProvider';
import { getDashboardUrl, usePerspective } from '../../hooks/usePerspective';
import { DashboardResource } from '@perses-dev/core';

export const useDashboardProjects = () => {
  const {
    editableProjects,
    allProjects,
    hasEditableProject,
    permissionsLoading,
    permissionsError,
  } = useEditableProjects();

  const { persesProjects } = usePerses();

  const defaultProject = React.useMemo(() => {
    return allProjects?.[0] || '';
  }, [allProjects]);

  const projectOptions = React.useMemo<SelectOptionProps[]>(() => {
    if (!editableProjects) {
      return [];
    }
    return editableProjects.map((project) => ({
      name: project,
      value: project,
      content: project,
      children: project,
    }));
  }, [editableProjects]);

  return {
    editableProjects,
    allProjects,
    hasEditableProject,
    permissionsLoading,
    permissionsError,
    persesProjects,
    defaultProject,
    projectOptions,
  };
};

export const useProjectCreation = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { addAlert } = useToast();
  const createProjectMutation = useCreateProjectMutation();

  const ensureProjectExists = async (projectName: string, persesProjects: any[]) => {
    const projectExists = persesProjects?.some((project) => project.metadata.name === projectName);

    if (!projectExists) {
      try {
        await createProjectMutation.mutateAsync(projectName);
        addAlert(
          t('Project "{{project}}" created successfully', { project: projectName }),
          'success',
        );
      } catch (projectError) {
        const errorMessage =
          (() => {
            if (projectError instanceof Error) return projectError.message;
            if (
              typeof projectError === 'object' &&
              projectError !== null &&
              'message' in projectError
            ) {
              return String((projectError as { message: unknown }).message);
            }
            return typeof projectError === 'string' ? projectError : undefined;
          })() ||
          t('Failed to create project "{{project}}". Please try again.', { project: projectName });

        addAlert(t('Error creating project: {{error}}', { error: errorMessage }), 'danger');
        throw projectError; // Re-throw to stop the calling operation
      }
    }
  };

  return {
    ensureProjectExists,
    isCreatingProject: createProjectMutation.isPending,
  };
};

export const useDashboardNavigation = () => {
  const navigate = useNavigate();
  const { perspective } = usePerspective();

  const navigateToDashboard = (dashboard: DashboardResource, editMode = true) => {
    const dashboardUrl = getDashboardUrl(perspective);
    const dashboardParam = `dashboard=${dashboard.metadata.name}`;
    const projectParam = `project=${dashboard.metadata.project}`;
    const editModeParam = editMode ? `edit=true` : '';
    const queryParams = [dashboardParam, projectParam, editModeParam].filter(Boolean).join('&');
    navigate(`${dashboardUrl}?${queryParams}`);
  };

  return { navigateToDashboard };
};

interface PermissionStateProps {
  permissionsLoading: boolean;
  permissionsError: unknown;
  children: React.ReactNode;
}

export const PermissionStateWrapper: React.FC<PermissionStateProps> = ({
  permissionsLoading,
  permissionsError,
  children,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  if (permissionsLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        {t('Loading...')} <Spinner aria-label="Dashboard Modal Loading" />
      </div>
    );
  }

  if (permissionsError) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <ExclamationCircleIcon />
        {t('Failed to load project permissions. Please refresh the page and try again.')}
      </div>
    );
  }

  return <>{children}</>;
};

interface ProjectSelectFormGroupProps {
  control: Control<any>;
  projectOptions: SelectOptionProps[];
  defaultValue: string;
  label?: string;
  required?: boolean;
  maxHeight?: string;
}

export const ProjectSelectFormGroup: React.FC<ProjectSelectFormGroupProps> = ({
  control,
  projectOptions,
  defaultValue,
  label,
  required = true,
  maxHeight = '200px',
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Controller
      control={control}
      name="projectName"
      render={({ field, fieldState }) => (
        <FormGroup
          label={label || t('Select project')}
          isRequired={required}
          fieldId="project-select-form-group"
          style={formGroupStyle}
        >
          <LabelSpacer />
          <TypeaheadSelect
            options={projectOptions}
            onSelect={(selection) => {
              field.onChange(selection);
            }}
            defaultValue={defaultValue}
            retainValue
            maxHeight={maxHeight}
          />
          {fieldState.error && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                  {fieldState.error.message}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>
      )}
    />
  );
};
