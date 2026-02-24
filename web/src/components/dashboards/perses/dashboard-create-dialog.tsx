import * as React from 'react';
import {
  Alert,
  Button,
  Modal,
  ModalVariant,
  FormGroup,
  TextInput,
  FormHelperText,
  HelperText,
  HelperTextItem,
  ValidatedOptions,
  SelectOptionProps,
  Tooltip,
  AlertVariant,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { usePerses } from './hooks/usePerses';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';

import { DashboardResource, getResourceExtendedDisplayName } from '@perses-dev/core';
import { useCreateDashboardMutation, useCreateProjectMutation } from './dashboard-api';
import { createNewDashboard } from './dashboard-utils';
import { useToast } from './ToastProvider';
import { usePerspective, getDashboardUrl } from '../../hooks/usePerspective';
import { useEditableProjects } from './hooks/useEditableProjects';
import { TypeaheadSelect } from '../../TypeaheadSelect';
import {
  createDashboardDialogValidationSchema,
  CreateDashboardValidationType,
  useDashboardValidationSchema,
} from './dashboard-action-validations';
import { Controller, FormProvider, SubmitHandler, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { formGroupStyle, LabelSpacer } from './dashboard-action-modals';

export const DashboardCreateDialog: React.FunctionComponent = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const history = useHistory();
  const { perspective } = usePerspective();
  const { addAlert } = useToast();
  const { editableProjects, hasEditableProject, permissionsLoading, permissionsError } =
    useEditableProjects();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const createDashboardMutation = useCreateDashboardMutation();
  const createProjectMutation = useCreateProjectMutation();
  const { persesProjects } = usePerses();
  const disabled = permissionsLoading || !hasEditableProject;

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

  const defaultProject = React.useMemo(() => {
    return persesProjects[0]?.metadata?.name || '';
  }, [persesProjects]);

  const { schema: validationSchema } = useDashboardValidationSchema(t, defaultProject);

  const form = useForm<CreateDashboardValidationType>({
    resolver: validationSchema
      ? zodResolver(validationSchema)
      : zodResolver(createDashboardDialogValidationSchema(t)),
    mode: 'onBlur',
    defaultValues: {
      projectName: '',
      dashboardName: '',
    },
  });

  React.useEffect(() => {
    if (isModalOpen && editableProjects?.length > 0) {
      form.reset({
        projectName: '',
        dashboardName: '',
      });
    }
  }, [isModalOpen, editableProjects?.length, form]);

  const processForm: SubmitHandler<CreateDashboardValidationType> = async (data) => {
    // Check if project exists, create it if it doesn't
    const projectExists = persesProjects?.some(
      (project) => project.metadata.name === data.projectName,
    );

    if (!projectExists) {
      try {
        await createProjectMutation.mutateAsync(data.projectName);
        addAlert(
          t('Project "{{project}}" created successfully', { project: data.projectName }),
          'success',
        );
      } catch (projectError) {
        const errorMessage =
          projectError?.message ||
          t('Failed to create project "{{project}}". Please try again.', {
            project: data.projectName,
          });
        addAlert(t('Error creating project: {{error}}', { error: errorMessage }), 'danger');
        return;
      }
    }

    const newDashboard = createNewDashboard(data.dashboardName, data.projectName);

    createDashboardMutation.mutate(newDashboard, {
      onSuccess: (createdDashboard: DashboardResource) => {
        const msg = t(
          `Dashboard ${getResourceExtendedDisplayName(
            createdDashboard,
          )} has been successfully created`,
        );
        addAlert(msg, AlertVariant.success);

        handleModalToggle();

        const dashboardUrl = getDashboardUrl(perspective);
        const dashboardParam = `dashboard=${createdDashboard.metadata.name}`;
        const projectParam = `project=${createdDashboard.metadata.project}`;
        const editModeParam = `edit=true`;
        history.push(`${dashboardUrl}?${dashboardParam}&${projectParam}&${editModeParam}`);
      },
      onError: (err) => {
        const msg = t(`Could not create dashboard. ${err}`);
        addAlert(msg, AlertVariant.danger);
      },
    });
  };

  const onProjectSelect = (selection: string) => {
    form.setValue('projectName', selection);
  };

  const handleModalToggle = () => {
    if (isModalOpen) {
      form.reset();
    }
    setIsModalOpen(!isModalOpen);
  };

  const createBtn = (
    <Button variant="primary" onClick={handleModalToggle} isDisabled={disabled}>
      {permissionsLoading ? t('Checking permissions...') : t('Create')}
    </Button>
  );

  return (
    <>
      {!permissionsLoading && !hasEditableProject ? (
        <Tooltip
          content={t('To create dashboards, contact your cluster administrator for permission.')}
        >
          <span style={{ cursor: 'not-allowed' }}> {createBtn}</span>
        </Tooltip>
      ) : (
        createBtn
      )}
      <Modal
        variant={ModalVariant.small}
        title={t('Create Dashboard')}
        isOpen={isModalOpen}
        onClose={handleModalToggle}
        actions={[
          <Button
            key="create-modal-btn"
            variant="primary"
            isDisabled={
              !(form.watch('dashboardName') || '')?.trim() ||
              !(form.watch('projectName') || '')?.trim() ||
              !hasEditableProject
            }
            isLoading={createDashboardMutation.isPending || createProjectMutation.isPending}
            onClick={form.handleSubmit(processForm)}
          >
            {createDashboardMutation.isPending || createProjectMutation.isPending
              ? t('Creating...')
              : t('Create')}
          </Button>,
          <Button key="cancel" variant="link" onClick={handleModalToggle}>
            {t('Cancel')}
          </Button>,
        ]}
        aria-labelledby="modal-with-dropdown"
      >
        {permissionsError && (
          <Alert
            variant="danger"
            title={t('Failed to load project permissions. Please refresh the page and try again.')}
            isInline
            style={{ marginBottom: '16px' }}
          />
        )}
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(processForm)}>
            <Stack hasGutter>
              <StackItem>
                <Controller
                  control={form.control}
                  name="dashboardName"
                  render={({ field, fieldState }) => (
                    <FormGroup
                      label={t('Dashboard name')}
                      isRequired
                      fieldId="duplicate-modal-dashboard-name-form-group"
                      style={formGroupStyle}
                    >
                      <LabelSpacer />
                      <TextInput
                        {...field}
                        isRequired
                        type="text"
                        id="duplicate-modal-dashboard-name-form-group-text-input"
                        validated={
                          fieldState.error ? ValidatedOptions.error : ValidatedOptions.default
                        }
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
              </StackItem>
              <StackItem>
                <Controller
                  control={form.control}
                  name="projectName"
                  render={({ fieldState }) => (
                    <FormGroup
                      label={t('Select namespace')}
                      isRequired
                      fieldId="duplicate-modal-select-namespace-form-group"
                      style={formGroupStyle}
                    >
                      <LabelSpacer />
                      <TypeaheadSelect
                        options={projectOptions}
                        onSelect={onProjectSelect}
                        retainValue
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
              </StackItem>
            </Stack>
          </form>
        </FormProvider>
      </Modal>
    </>
  );
};
