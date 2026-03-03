import * as React from 'react';
import {
  Button,
  Modal,
  ModalVariant,
  FormGroup,
  TextInput,
  FormHelperText,
  HelperText,
  HelperTextItem,
  ValidatedOptions,
  Stack,
  StackItem,
  AlertVariant,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { Controller, FormProvider, SubmitHandler, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import {
  useDashboardProjects,
  useProjectCreation,
  useDashboardNavigation,
  PermissionStateWrapper,
  ProjectSelectFormGroup,
} from './dashboard-dialog-helpers';

import { DashboardResource } from '@perses-dev/core';
import { useCreateDashboardMutation } from './dashboard-api';
import { createNewDashboard } from './dashboard-utils';
import { useToast } from './ToastProvider';
import {
  createDashboardDialogValidationSchema,
  CreateDashboardValidationType,
  useDashboardValidationSchema,
} from './dashboard-action-validations';
import { formGroupStyle, LabelSpacer } from './dashboard-action-modals';

interface DashboardCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DashboardCreateDialog: React.FunctionComponent<DashboardCreateDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { addAlert } = useToast();

  const {
    editableProjects,
    hasEditableProject,
    permissionsLoading,
    permissionsError,
    persesProjects,
    defaultProject,
    projectOptions,
  } = useDashboardProjects();

  const { ensureProjectExists, isCreatingProject } = useProjectCreation();
  const { navigateToDashboard } = useDashboardNavigation();
  const createDashboardMutation = useCreateDashboardMutation();

  const { schema: validationSchema } = useDashboardValidationSchema(t, defaultProject);

  const form = useForm<CreateDashboardValidationType>({
    resolver: validationSchema
      ? zodResolver(validationSchema)
      : zodResolver(createDashboardDialogValidationSchema(t)),
    mode: 'onBlur',
    defaultValues: {
      projectName: defaultProject,
      dashboardName: '',
    },
  });

  React.useEffect(() => {
    if (isOpen && editableProjects?.length > 0 && defaultProject) {
      form.reset({
        projectName: defaultProject,
        dashboardName: '',
      });
    }
  }, [isOpen, defaultProject, editableProjects?.length, form]);

  const processForm: SubmitHandler<CreateDashboardValidationType> = async (data) => {
    try {
      await ensureProjectExists(data.projectName, persesProjects || []);
    } catch (error) {
      return;
    }

    const newDashboard: DashboardResource = createNewDashboard(
      data.dashboardName.trim(),
      data.projectName,
    );

    createDashboardMutation.mutate(newDashboard, {
      onSuccess: (createdDashboard: DashboardResource) => {
        const msg = t(`Dashboard "${data.dashboardName}" created successfully`);
        addAlert(msg, AlertVariant.success);

        handleClose();
        navigateToDashboard(createdDashboard, true);
      },
      onError: (err) => {
        const msg = t(`Could not create dashboard. ${err}`);
        addAlert(msg, AlertVariant.danger);
      },
    });
  };

  const handleClose = () => {
    onClose();
    form.reset();
  };

  const onProjectSelect = (selection: string) => {
    form.setValue('projectName', selection);
  };

  return (
    <Modal
      variant={ModalVariant.small}
      title={t('Create Dashboard')}
      actions={[
        <Button
          key="create-modal-btn-create"
          variant="primary"
          isDisabled={
            !(form.watch('dashboardName') || '')?.trim() ||
            !(form.watch('projectName') || '')?.trim() ||
            !hasEditableProject
          }
          isLoading={createDashboardMutation.isPending || isCreatingProject}
          onClick={form.handleSubmit(processForm)}
        >
          {t('Create')}
        </Button>,
        <Button key="create-modal-btn-cancel" variant="link" onClick={handleClose}>
          {t('Cancel')}
        </Button>,
      ]}
      isOpen={isOpen}
      onClose={handleClose}
      ouiaId="CreateModal"
      aria-labelledby="create-modal"
    >
      <PermissionStateWrapper
        permissionsLoading={permissionsLoading}
        permissionsError={permissionsError}
      >
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
                      fieldId="create-modal-dashboard-name-form-group"
                      style={formGroupStyle}
                    >
                      <LabelSpacer />
                      <TextInput
                        {...field}
                        isRequired
                        type="text"
                        id="create-modal-dashboard-name-form-group-text-input"
                        placeholder={t('my-new-dashboard')}
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
                <ProjectSelectFormGroup
                  control={form.control}
                  projectOptions={projectOptions}
                  onProjectSelect={onProjectSelect}
                  defaultValue={defaultProject}
                  label={t('Select namespace')}
                />
              </StackItem>
            </Stack>
          </form>
        </FormProvider>
      </PermissionStateWrapper>
    </Modal>
  );
};
