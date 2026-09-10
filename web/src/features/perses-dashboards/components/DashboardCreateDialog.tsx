import { zodResolver } from '@hookform/resolvers/zod';
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
import { DashboardResource } from '@perses-dev/client';
import { FC, useEffect } from 'react';
import { Controller, FormProvider, SubmitHandler, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  DashboardDeniedHelperText,
  formGroupStyle,
  LabelSpacer,
  ProjectSelectFormGroup,
  useDashboardNavigation,
  useDashboardProjects,
  useProjectCreation,
} from '@/features/perses-dashboards/components/DashboardDialogHelpers';
import { useToast } from '@/features/perses-dashboards/components/ToastProvider';
import { usePersesDashboardAccess } from '@/features/perses-dashboards/hooks/usePersesDashboardAccess';
import {
  createDashboardDialogValidationSchema,
  CreateDashboardValidationType,
  useDashboardValidationSchema,
} from '@/features/perses-dashboards/utils/dashboard-action-validations';
import { useCreateDashboardMutation } from '@/features/perses-dashboards/utils/dashboard-api';
import { createNewDashboard } from '@/features/perses-dashboards/utils/dashboard-utils';

interface DashboardCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DashboardCreateDialog: FC<DashboardCreateDialogProps> = ({ isOpen, onClose }) => {
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

  // eslint-disable-next-line react-hooks/incompatible-library
  const selectedProject = form.watch('projectName');
  const [canCreate, checkingAccess] = usePersesDashboardAccess(
    'create',
    selectedProject || null,
    isOpen,
  );
  const createDenied = !!selectedProject && !checkingAccess && !canCreate;

  useEffect(() => {
    if (isOpen && defaultProject) {
      form.reset({
        projectName: defaultProject,
        dashboardName: '',
      });
    }
  }, [isOpen, defaultProject, form]);

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
            // eslint-disable-next-line react-hooks/incompatible-library
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
