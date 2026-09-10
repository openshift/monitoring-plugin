import {
  AlertVariant,
  Button,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Stack,
  StackItem,
  TextInput,
  ValidatedOptions,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';

import { zodResolver } from '@hookform/resolvers/zod';
import { DashboardResource } from '@perses-dev/core';
import React, { useEffect } from 'react';
import { Controller, FormProvider, SubmitHandler, useForm } from 'react-hook-form';
import { formGroupStyle, LabelSpacer } from './dashboard-action-modals';
import {
  createDashboardDialogValidationSchema,
  CreateDashboardValidationType,
  useDashboardValidationSchema,
} from './dashboard-action-validations';
import { useCreateDashboardMutation } from './dashboard-api';
import {
  DashboardDeniedHelperText,
  ProjectSelectFormGroup,
  useDashboardNavigation,
  useDashboardProjects,
  useProjectCreation,
} from './dashboard-dialog-helpers';
import { usePersesDashboardAccess } from './hooks/usePersesDashboardAccess';
import { createNewDashboard } from './dashboard-utils';
import { useToast } from './ToastProvider';

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

  const { defaultProject, projectOptions } = useDashboardProjects();

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

  useEffect(() => {
    if (isOpen && defaultProject) {
      form.reset({
        projectName: defaultProject,
        dashboardName: '',
      });
    }
  }, [isOpen, defaultProject, form]);

  const selectedProject = form.watch('projectName');
  const [canCreate, checkingAccess] = usePersesDashboardAccess(
    'create',
    selectedProject || null,
    isOpen,
  );
  const createDenied = !!selectedProject && !checkingAccess && !canCreate;

  const processForm: SubmitHandler<CreateDashboardValidationType> = async (data) => {
    try {
      await ensureProjectExists(data.projectName);
    } catch {
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

  return (
    <Modal
      variant={ModalVariant.small}
      isOpen={isOpen}
      onClose={handleClose}
      ouiaId="CreateModal"
      aria-labelledby="create-modal-title"
    >
      <ModalHeader title={t('Create Dashboard')} labelId="create-modal-title" />
      <ModalBody>
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
                            <HelperTextItem variant="error">
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
                  defaultValue={defaultProject}
                  label={t('Select project')}
                />
                <DashboardDeniedHelperText show={createDenied} verb="create" />
              </StackItem>
            </Stack>
          </form>
        </FormProvider>
      </ModalBody>
      <ModalFooter>
        <Button
          key="create-modal-btn-create"
          variant="primary"
          isDisabled={
            !(form.watch('dashboardName') || '')?.trim() ||
            !selectedProject?.trim() ||
            checkingAccess ||
            createDenied
          }
          isLoading={createDashboardMutation.isPending || isCreatingProject}
          onClick={form.handleSubmit(processForm)}
        >
          {t('Create')}
        </Button>
        <Button key="create-modal-btn-cancel" variant="link" onClick={handleClose}>
          {t('Cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
