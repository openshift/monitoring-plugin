import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  FormGroup,
  TextInput,
  FormHelperText,
  HelperText,
  HelperTextItem,
  ValidatedOptions,
  HelperTextItemVariant,
  ModalVariant,
  AlertVariant,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { TypeaheadSelect, TypeaheadSelectOption } from '@patternfly/react-templates';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { CSSProperties, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useUpdateDashboardMutation,
  useCreateDashboardMutation,
  useDeleteDashboardMutation,
} from './dashboard-api';
import {
  renameDashboardDialogValidationSchema,
  RenameDashboardValidationType,
  createDashboardDialogValidationSchema,
  CreateDashboardValidationType,
  useDashboardValidationSchema,
} from './dashboard-action-validations';

import { Controller, FormProvider, SubmitHandler, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DashboardResource, getResourceExtendedDisplayName } from '@perses-dev/core';
import { useToast } from './ToastProvider';
import { generateMetadataName } from './dashboard-utils';
import {
  DashboardDeniedHelperText,
  useDashboardProjects,
  useProjectCreation,
} from './dashboard-dialog-helpers';
import { useOcpProjects } from './hooks/useOcpProjects';
import { usePersesDashboardAccess } from './hooks/usePersesDashboardAccess';
import { t_global_spacer_200, t_global_font_weight_200 } from '@patternfly/react-tokens';
import { useNavigate } from 'react-router';
import { usePerspective, getDashboardUrl } from '../../hooks/usePerspective';

export const formGroupStyle = {
  fontWeight: t_global_font_weight_200.value,
} as CSSProperties;

export const LabelSpacer = () => {
  return <div style={{ paddingBottom: t_global_spacer_200.value }} />;
};

interface ActionModalProps {
  dashboard: DashboardResource;
  isOpen: boolean;
  onClose: () => void;
  handleModalClose: () => void;
}

export const RenameActionModal = ({ dashboard, isOpen, onClose }: ActionModalProps) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { addAlert } = useToast();

  const form = useForm<RenameDashboardValidationType>({
    resolver: zodResolver(renameDashboardDialogValidationSchema(t)),
    mode: 'onBlur',
    defaultValues: { dashboardName: '' },
  });

  const updateDashboardMutation = useUpdateDashboardMutation();
  const [canUpdate, updateChecking] = usePersesDashboardAccess(
    'update',
    dashboard?.metadata?.project ?? null,
    isOpen && !!dashboard?.metadata?.project,
  );
  const updateDenied = !updateChecking && !canUpdate;

  if (!dashboard) {
    return null;
  }

  const processForm: SubmitHandler<RenameDashboardValidationType> = (data) => {
    if (dashboard.spec?.display) {
      dashboard.spec.display.name = data.dashboardName;
    } else {
      dashboard.spec.display = { name: data.dashboardName };
    }

    updateDashboardMutation.mutate(dashboard, {
      onSuccess: (updatedDashboard: DashboardResource) => {
        const msg = t(
          `Dashboard ${getResourceExtendedDisplayName(
            updatedDashboard,
          )} has been successfully updated`,
        );
        addAlert(msg, AlertVariant.success);
        handleClose();
      },
      onError: (err) => {
        const msg = t(`Could not rename dashboard. ${err}`);
        addAlert(msg, AlertVariant.danger);
        throw err;
      },
    });
  };

  const handleClose = () => {
    onClose();
    form.reset({ dashboardName: '' });
  };

  return (
    <Modal
      variant={ModalVariant.small}
      isOpen={isOpen}
      onClose={handleClose}
      ouiaId="RenameModal"
      aria-labelledby="rename-modal"
    >
      <ModalHeader title={t('Rename Dashboard')} labelId="rename-modal-title" />
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(processForm)}>
          <ModalBody id="rename-modal-box">
            <Controller
              control={form.control}
              name="dashboardName"
              render={({ field, fieldState }) => (
                <FormGroup
                  label={t('Dashboard name')}
                  isRequired
                  fieldId="rename-modal-form-group"
                  style={formGroupStyle}
                >
                  <LabelSpacer />
                  <TextInput
                    {...field}
                    isRequired
                    type="text"
                    id="rename-modal-text-input"
                    name="rename-modal-text-input"
                    validated={fieldState.error ? ValidatedOptions.error : ValidatedOptions.default}
                  />
                  {fieldState.error && (
                    <FormHelperText>
                      <HelperText>
                        <HelperTextItem
                          icon={<ExclamationCircleIcon />}
                          variant={HelperTextItemVariant.error}
                        >
                          {fieldState.error.message}
                        </HelperTextItem>
                      </HelperText>
                    </FormHelperText>
                  )}
                </FormGroup>
              )}
            />
            <DashboardDeniedHelperText show={updateDenied} verb="update" />
          </ModalBody>
          <ModalFooter>
            <Button
              key="rename-modal-btn-rename"
              variant="primary"
              type="submit"
              isDisabled={
                !(form.watch('dashboardName') || '')?.trim() ||
                updateDashboardMutation.isPending ||
                updateChecking ||
                updateDenied
              }
              isLoading={updateDashboardMutation.isPending}
            >
              {updateDashboardMutation.isPending ? t('Renaming...') : t('Rename')}
            </Button>
            <Button key="rename-modal-btn-cancel" variant="link" onClick={handleClose}>
              {t('Cancel')}
            </Button>
          </ModalFooter>
        </form>
      </FormProvider>
    </Modal>
  );
};

export const DuplicateActionModal = ({ dashboard, isOpen, onClose }: ActionModalProps) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { addAlert } = useToast();

  const navigate = useNavigate();
  const { perspective } = usePerspective();

  const { ocpProjects } = useOcpProjects();
  const { availableProjects } = useDashboardProjects();
  const { ensureProjectExists, isCreatingProject } = useProjectCreation();

  const defaultProject = useMemo(() => {
    if (!dashboard) return '';

    return dashboard.metadata.project || availableProjects[0] || '';
  }, [dashboard, availableProjects]);

  const form = useForm<CreateDashboardValidationType>({
    resolver: zodResolver(createDashboardDialogValidationSchema(t)),
    mode: 'onBlur',
    defaultValues: {
      projectName: defaultProject,
      dashboardName: '',
    },
  });

  const selectedProjectName = form.watch('projectName');
  const dashboardName = form.watch('dashboardName');

  const { schema: dynamicValidationSchema, isSchemaLoading } = useDashboardValidationSchema(
    t,
    selectedProjectName,
  );

  const projectOptions = useMemo<TypeaheadSelectOption[]>(() => {
    return availableProjects.map((project) => ({
      content: project,
      value: project,
      selected: project === selectedProjectName,
    }));
  }, [availableProjects, selectedProjectName]);

  const [canCreate, checkingAccess] = usePersesDashboardAccess(
    'create',
    selectedProjectName || null,
    isOpen && !!dashboard?.metadata?.project,
  );
  const createDenied = !!selectedProjectName && !checkingAccess && !canCreate;

  const createDashboardMutation = useCreateDashboardMutation();

  useEffect(() => {
    const isPerseProject = ocpProjects?.some(
      (project) => project.metadata?.name === selectedProjectName,
    );

    if (dynamicValidationSchema && selectedProjectName && !isSchemaLoading && isPerseProject) {
      const currentValues = form.getValues();
      const result = dynamicValidationSchema.safeParse(currentValues);

      if (!result.success) {
        const hasDashboardIssue = result.error.issues.some(
          (issue) => issue.path[0] === 'dashboardName',
        );

        if (hasDashboardIssue) {
          result.error.issues.forEach((issue) => {
            if (issue.path[0] === 'dashboardName') {
              form.setError('dashboardName', {
                type: 'validate',
                message: issue.message,
              });
            }
          });
        } else {
          form.clearErrors('dashboardName');
        }
      } else {
        form.clearErrors('dashboardName');
      }
    } else if (!isPerseProject && selectedProjectName) {
      // Clear any existing validation errors for non-Perses projects
      form.clearErrors('dashboardName');
    }
  }, [
    selectedProjectName,
    dynamicValidationSchema,
    form,
    dashboardName,
    isSchemaLoading,
    ocpProjects,
  ]);

  useEffect(() => {
    if (isOpen && dashboard && defaultProject) {
      form.reset({
        projectName: defaultProject,
        dashboardName: '',
      });
    }
  }, [isOpen, dashboard, defaultProject, form]);

  if (!dashboard) {
    return null;
  }

  const processForm: SubmitHandler<CreateDashboardValidationType> = async (data) => {
    try {
      await ensureProjectExists(data.projectName);
    } catch {
      return;
    }

    const newDashboard: DashboardResource = {
      ...dashboard,
      metadata: {
        ...dashboard.metadata,
        name: generateMetadataName(data.dashboardName),
        project: data.projectName,
      },
      spec: {
        ...dashboard.spec,
        display: {
          ...dashboard.spec.display,
          name: data.dashboardName,
        },
      },
    };

    createDashboardMutation.mutate(newDashboard, {
      onSuccess: (createdDashboard: DashboardResource) => {
        const msg = t(
          `Dashboard ${getResourceExtendedDisplayName(
            createdDashboard,
          )} has been successfully created`,
        );
        addAlert(msg, AlertVariant.success);

        handleClose();

        const dashboardUrl = getDashboardUrl(perspective);
        const dashboardParam = `dashboard=${createdDashboard.metadata.name}`;
        const projectParam = `project=${createdDashboard.metadata.project}`;
        const editModeParam = `edit=true`;
        navigate(`${dashboardUrl}?${dashboardParam}&${projectParam}&${editModeParam}`);
      },
      onError: (err) => {
        const msg = t(`Could not duplicate dashboard. ${err}`);
        addAlert(msg, AlertVariant.danger);
      },
    });
  };

  const handleClose = () => {
    onClose();
    form.reset({ dashboardName: '' });
  };

  const onProjectSelect = (_event: any, selection: string) => {
    form.setValue('projectName', selection);
  };

  return (
    <Modal
      variant={ModalVariant.small}
      isOpen={isOpen}
      onClose={handleClose}
      ouiaId="DuplicateModal"
      aria-labelledby="duplicate-modal"
    >
      <ModalHeader title={t('Duplicate Dashboard')} labelId="duplicate-modal-title" />
      {
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(processForm)}>
            <ModalBody>
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
                              <HelperTextItem
                                icon={<ExclamationCircleIcon />}
                                variant={HelperTextItemVariant.error}
                              >
                                {fieldState.error.message}
                              </HelperTextItem>
                            </HelperText>
                          </FormHelperText>
                        )}
                        <DashboardDeniedHelperText show={createDenied} verb="create" />
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
                          key={selectedProjectName || 'no-selection'}
                          initialOptions={projectOptions}
                          placeholder={t('Select namespace')}
                          noOptionsFoundMessage={(filter) =>
                            t('No namespace found for "{{filter}}"', { filter })
                          }
                          onClearSelection={() => {
                            form.setValue('projectName', '');
                          }}
                          onSelect={onProjectSelect}
                          isCreatable={false}
                          maxMenuHeight="200px"
                        />
                        {fieldState.error && (
                          <FormHelperText>
                            <HelperText>
                              <HelperTextItem
                                icon={<ExclamationCircleIcon />}
                                variant={HelperTextItemVariant.error}
                              >
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
            </ModalBody>
            <ModalFooter>
              <Button
                key="duplicate-modal-btn-duplicate"
                variant="primary"
                type="submit"
                isDisabled={
                  !(form.watch('dashboardName') || '')?.trim() ||
                  !(form.watch('projectName') || '')?.trim() ||
                  checkingAccess ||
                  createDenied ||
                  isSchemaLoading ||
                  createDashboardMutation.isPending ||
                  isCreatingProject
                }
                isLoading={
                  createDashboardMutation.isPending || isCreatingProject || isSchemaLoading
                }
              >
                {t('Duplicate')}
              </Button>
              <Button key="duplicate-modal-btn-cancel" variant="link" onClick={handleClose}>
                {t('Cancel')}
              </Button>
            </ModalFooter>
          </form>
        </FormProvider>
      }
    </Modal>
  );
};

export const DeleteActionModal = ({ dashboard, isOpen, onClose }: ActionModalProps) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { addAlert } = useToast();

  const deleteDashboardMutation = useDeleteDashboardMutation();
  const dashboardName = dashboard?.spec?.display?.name ?? t('this dashboard');
  const [canDelete, deleteChecking] = usePersesDashboardAccess(
    'delete',
    dashboard?.metadata?.project ?? null,
    isOpen && !!dashboard?.metadata?.project,
  );
  const deleteDenied = !deleteChecking && !canDelete;

  const handleDeleteConfirm = async () => {
    if (!dashboard) return;

    deleteDashboardMutation.mutate(dashboard, {
      onSuccess: (deletedDashboard: DashboardResource) => {
        const msg = t(
          `Dashboard ${getResourceExtendedDisplayName(
            deletedDashboard,
          )} has been successfully deleted`,
        );
        addAlert(msg, AlertVariant.success);
        onClose();
      },
      onError: (err) => {
        const msg = t(`Could not delete dashboard. ${err}`);
        addAlert(msg, AlertVariant.danger);
        throw err;
      },
    });
  };

  return (
    <Modal
      variant={ModalVariant.small}
      isOpen={isOpen}
      onClose={onClose}
      ouiaId="DeleteModal"
      aria-labelledby="delete-modal"
    >
      <ModalHeader
        titleIconVariant="warning"
        title={t('Permanently delete dashboard?')}
        labelId="delete-modal-title"
      />
      <ModalBody id="delete-modal-box-body">
        {t('Are you sure you want to delete ')}
        <strong>{dashboardName}</strong>
        {t('? This action can not be undone.')}
        <DashboardDeniedHelperText show={deleteDenied} verb="delete" />
      </ModalBody>
      <ModalFooter>
        <Button
          key="delete-modal-btn-delete"
          onClick={handleDeleteConfirm}
          isDisabled={
            !dashboard || deleteDashboardMutation.isPending || deleteChecking || deleteDenied
          }
          isLoading={deleteDashboardMutation.isPending}
        >
          {deleteDashboardMutation.isPending ? t('Deleting...') : t('Delete')}
        </Button>
        <Button key="delete-modal-btn-cancel" variant="link" onClick={onClose}>
          {t('Cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
