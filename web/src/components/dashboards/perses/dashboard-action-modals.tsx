import {
  Button,
  Modal,
  FormGroup,
  TextInput,
  FormHelperText,
  HelperText,
  HelperTextItem,
  ValidatedOptions,
  ModalVariant,
  AlertVariant,
  Select,
  SelectOption,
  SelectList,
  MenuToggle,
  MenuToggleElement,
  Stack,
  StackItem,
  Spinner,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import * as React from 'react';
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
import {
  DashboardResource,
  getResourceDisplayName,
  getResourceExtendedDisplayName,
} from '@perses-dev/core';
import { useToast } from './ToastProvider';
import { usePerses } from './hooks/usePerses';
import { generateMetadataName } from './dashboard-utils';
import { useProjectPermissions } from './dashboard-permissions';
import { useHistory } from 'react-router-dom';
import { usePerspective, getDashboardUrl } from '../../hooks/usePerspective';

const formGroupStyle = {
  fontWeight: 'var(--pf-v5-global--FontWeight--normal)',
} as React.CSSProperties;

const LabelSpacer = () => {
  return <div style={{ paddingBottom: 'var(--pf-v5-global--spacer--sm)' }} />;
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
    defaultValues: { dashboardName: dashboard ? getResourceDisplayName(dashboard) : '' },
  });

  const updateDashboardMutation = useUpdateDashboardMutation();

  React.useEffect(() => {
    if (isOpen && dashboard) {
      form.reset({ dashboardName: getResourceDisplayName(dashboard) });
    }
  }, [isOpen, dashboard, form]);

  if (!dashboard) {
    return null;
  }

  const processForm: SubmitHandler<RenameDashboardValidationType> = (data) => {
    const updatedDashboard: DashboardResource = {
      ...dashboard,
      spec: {
        ...dashboard.spec,
        display: {
          ...dashboard.spec?.display,
          name: data.dashboardName,
        },
      },
    };
    updateDashboardMutation.mutate(updatedDashboard, {
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
      actions={[
        <Button
          key="rename-modal-btn-rename"
          variant="primary"
          isDisabled={
            !(form.watch('dashboardName') || '')?.trim() || updateDashboardMutation.isPending
          }
          isLoading={updateDashboardMutation.isPending}
          onClick={form.handleSubmit(processForm)}
        >
          {updateDashboardMutation.isPending ? t('Renaming...') : t('Rename')}
        </Button>,
        <Button key="rename-modal-btn-cancel" variant="link" onClick={handleClose}>
          {t('Cancel')}
        </Button>,
      ]}
      title={t('Rename Dashboard')}
      onClose={handleClose}
      ouiaId="RenameModal"
      aria-labelledby="rename-modal"
    >
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(processForm)}>
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
                      <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                        {fieldState.error.message}
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                )}
              </FormGroup>
            )}
          />
        </form>
      </FormProvider>
    </Modal>
  );
};

export const DuplicateActionModal = ({ dashboard, isOpen, onClose }: ActionModalProps) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { addAlert } = useToast();

  const history = useHistory();
  const { perspective } = usePerspective();
  const [isProjectSelectOpen, setIsProjectSelectOpen] = React.useState(false);

  const { persesProjects, persesProjectsLoading } = usePerses();

  const hookInput = React.useMemo(() => {
    return persesProjects || [];
  }, [persesProjects]);

  const { editableProjects } = useProjectPermissions(hookInput);

  const filteredProjects = React.useMemo(() => {
    return persesProjects.filter((project) => editableProjects.includes(project.metadata.name));
  }, [persesProjects, editableProjects]);

  const defaultProject = React.useMemo(() => {
    if (!dashboard) return '';

    if (dashboard.metadata.project && editableProjects.includes(dashboard.metadata.project)) {
      return dashboard.metadata.project;
    }

    return filteredProjects[0]?.metadata.name || '';
  }, [dashboard, editableProjects, filteredProjects]);

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

  const createDashboardMutation = useCreateDashboardMutation();

  React.useEffect(() => {
    if (isOpen && dashboard && filteredProjects.length > 0 && defaultProject) {
      form.reset({
        projectName: defaultProject,
        dashboardName: '',
      });
    }
  }, [isOpen, dashboard, defaultProject, filteredProjects.length, form]);

  const selectedProjectName = form.watch('projectName');
  const selectedProjectDisplay = React.useMemo(() => {
    const selectedProject = filteredProjects.find((p) => p.metadata.name === selectedProjectName);
    return selectedProject
      ? getResourceDisplayName(selectedProject)
      : selectedProjectName || t('Select project');
  }, [filteredProjects, selectedProjectName, t]);

  if (!dashboard) {
    return null;
  }

  const processForm: SubmitHandler<CreateDashboardValidationType> = (data) => {
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
        history.push(`${dashboardUrl}?${dashboardParam}&${projectParam}&${editModeParam}`);
      },
      onError: (err) => {
        const msg = t(`Could not duplicate dashboard. ${err}`);
        addAlert(msg, AlertVariant.danger);
      },
    });
  };

  const handleClose = () => {
    onClose();
    form.reset();
  };

  const onProjectToggle = () => {
    setIsProjectSelectOpen(!isProjectSelectOpen);
  };

  const onProjectSelect = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined,
  ) => {
    if (typeof value === 'string') {
      form.setValue('projectName', value);
      setIsProjectSelectOpen(false);
    }
  };

  return (
    <Modal
      variant={ModalVariant.small}
      title="Duplicate Dashboard"
      actions={[
        <Button
          key="duplicate-modal-btn-duplicate"
          variant="primary"
          isDisabled={
            !(form.watch('dashboardName') || '')?.trim() ||
            !(form.watch('projectName') || '')?.trim() ||
            createDashboardMutation.isPending
          }
          isLoading={createDashboardMutation.isPending}
          onClick={form.handleSubmit(processForm)}
        >
          {t('Duplicate')}
        </Button>,
        <Button key="duplicate-modal-btn-cancel" variant="link" onClick={handleClose}>
          {t('Cancel')}
        </Button>,
      ]}
      isOpen={isOpen}
      onClose={handleClose}
      ouiaId="DuplicateModal"
      aria-labelledby="duplicate-modal"
    >
      {persesProjectsLoading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          {t('Loading...')} <Spinner aria-label="Duplicate Dashboard Modal Loading" />
        </div>
      ) : (
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
                  render={({ field, fieldState }) => (
                    <FormGroup
                      label={t('Select namespace')}
                      isRequired
                      fieldId="duplicate-modal-select-namespace-form-group"
                      style={formGroupStyle}
                    >
                      <LabelSpacer />
                      <Select
                        id="duplicate-modal-select-namespace-form-group-select"
                        isOpen={isProjectSelectOpen}
                        selected={field.value}
                        onSelect={onProjectSelect}
                        onOpenChange={setIsProjectSelectOpen}
                        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                          <MenuToggle
                            ref={toggleRef}
                            onClick={onProjectToggle}
                            isExpanded={isProjectSelectOpen}
                            isFullWidth
                          >
                            {selectedProjectDisplay}
                          </MenuToggle>
                        )}
                      >
                        <SelectList>
                          {filteredProjects.map((project) => (
                            <SelectOption key={project.metadata.name} value={project.metadata.name}>
                              {getResourceDisplayName(project)}
                            </SelectOption>
                          ))}
                        </SelectList>
                      </Select>
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
      )}
    </Modal>
  );
};

export const DeleteActionModal = ({ dashboard, isOpen, onClose }: ActionModalProps) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { addAlert } = useToast();

  const deleteDashboardMutation = useDeleteDashboardMutation();
  const dashboardName = dashboard?.spec?.display?.name ?? t('this dashboard');

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
      },
    });
  };

  return (
    <Modal
      variant={ModalVariant.small}
      title={t('Permanently delete dashboard?')}
      titleIconVariant="warning"
      actions={[
        <Button
          key="delete-modal-btn-delete"
          onClick={handleDeleteConfirm}
          isDisabled={!dashboard || deleteDashboardMutation.isPending}
          isLoading={deleteDashboardMutation.isPending}
        >
          {deleteDashboardMutation.isPending ? t('Deleting...') : t('Delete')}
        </Button>,
        <Button key="delete-modal-btn-cancel" variant="link" onClick={onClose}>
          {t('Cancel')}
        </Button>,
      ]}
      isOpen={isOpen}
      onClose={onClose}
      ouiaId="DeleteModal"
      aria-labelledby="delete-modal"
    >
      {t('Are you sure you want to delete ')}
      <strong>{dashboardName}</strong>
      {t('? This action can not be undone.')}
    </Modal>
  );
};
