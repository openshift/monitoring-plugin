import { useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import { FormGroup, FormHelperText, HelperText, HelperTextItem } from '@patternfly/react-core';
import type { SelectOptionProps } from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { TypeaheadSelect } from '@patternfly/react-templates';
import { t_global_font_weight_200, t_global_spacer_200 } from '@patternfly/react-tokens';
import type { DashboardResource } from '@perses-dev/client';
import { useMemo } from 'react';
import type { CSSProperties, FC } from 'react';
import { Controller } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { useToast } from '@/features/perses-dashboards/components/ToastProvider';
import { useOcpProjects } from '@/features/perses-dashboards/hooks/useOcpProjects';
import { usePerses } from '@/features/perses-dashboards/hooks/usePerses';
import type { DashboardVerb } from '@/features/perses-dashboards/hooks/usePersesDashboardAccess';
import { useCreateProjectMutation } from '@/features/perses-dashboards/utils/dashboard-api';
import { persesDashboardDataTestIDs } from '@/shared/constants/data-test';
import { getDashboardUrl, usePerspective } from '@/shared/hooks/usePerspective';
import { ALL_NAMESPACES_KEY } from '@/shared/utils/utils';

export const formGroupStyle = {
  fontWeight: t_global_font_weight_200.value,
} as CSSProperties;

export const LabelSpacer: FC = () => {
  return <div style={{ paddingBottom: t_global_spacer_200.value }} />;
};

export const useDashboardProjects = () => {
  const [activeNamespace] = useActiveNamespace();
  const { ocpProjects } = useOcpProjects();

  const availableProjects = useMemo(() => {
    const names = new Set<string>();
    ocpProjects.forEach((project) => {
      if (project.metadata?.name) {
        names.add(project.metadata.name);
      }
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [ocpProjects]);

  const defaultProject = useMemo(() => {
    if (activeNamespace && activeNamespace !== ALL_NAMESPACES_KEY) {
      return activeNamespace;
    }
    return availableProjects[0] || '';
  }, [activeNamespace, availableProjects]);

  const projectOptions = useMemo<SelectOptionProps[]>(() => {
    return availableProjects.map((project) => ({
      name: project,
      value: project,
      content: project,
      children: project,
    }));
  }, [availableProjects]);

  return {
    availableProjects,
    defaultProject,
    projectOptions,
  };
};

export const useProjectCreation = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { addAlert } = useToast();
  const createProjectMutation = useCreateProjectMutation();
  const { persesProjects } = usePerses();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ensureProjectExists = async (projectName: string) => {
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

export const DashboardDeniedHelperText: FC<{ show: boolean; verb: DashboardVerb }> = ({
  show,
  verb,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  if (!show) {
    return null;
  }
  const { message, dataTest } = {
    create: {
      message: t('You do not have permission to create dashboards in this project.'),
      dataTest: persesDashboardDataTestIDs.createAccessDeniedHelperText,
    },
    update: {
      message: t('You do not have permission to edit dashboards in this project.'),
      dataTest: persesDashboardDataTestIDs.updateAccessDeniedHelperText,
    },
    delete: {
      message: t('You do not have permission to delete dashboards in this project.'),
      dataTest: persesDashboardDataTestIDs.deleteAccessDeniedHelperText,
    },
  }[verb];
  return (
    <FormHelperText>
      <HelperText>
        <HelperTextItem icon={<ExclamationCircleIcon />} variant="error" data-test={dataTest}>
          {message}
        </HelperTextItem>
      </HelperText>
    </FormHelperText>
  );
};

interface ProjectSelectFormGroupProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  projectOptions: SelectOptionProps[];
  defaultValue: string;
  label?: string;
  required?: boolean;
  maxHeight?: string;
}

export const ProjectSelectFormGroup: FC<ProjectSelectFormGroupProps> = ({
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
      render={({ field, fieldState }) => {
        const currentValue = field.value || defaultValue;
        return (
          <FormGroup
            label={label || t('Select project')}
            isRequired={required}
            fieldId="project-select-form-group"
            style={formGroupStyle}
          >
            <LabelSpacer />
            <TypeaheadSelect
              key={currentValue || 'no-selection'}
              initialOptions={projectOptions.map((op) => ({
                content: op.value,
                value: op.value,
                selected: op.value === currentValue,
              }))}
              placeholder={t('Select project')}
              noOptionsFoundMessage={(filter) =>
                t('No namespace found for "{{filter}}"', { filter })
              }
              onSelect={(_e, project) => {
                field.onChange(project as string);
              }}
              isCreatable={false}
              maxMenuHeight={maxHeight}
            />
            {fieldState.error && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">{fieldState.error.message}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
        );
      }}
    />
  );
};
