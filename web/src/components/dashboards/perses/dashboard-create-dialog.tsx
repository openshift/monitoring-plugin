import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Dropdown,
  DropdownList,
  DropdownItem,
  MenuToggle,
  MenuToggleElement,
  Modal,
  ModalBody,
  ModalHeader,
  ModalFooter,
  ModalVariant,
  FormGroup,
  Form,
  TextInput,
  FormHelperText,
  HelperText,
  HelperTextItem,
  HelperTextItemVariant,
  ValidatedOptions,
} from '@patternfly/react-core';
import { useQuery } from '@tanstack/react-query';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { usePerses } from './hooks/usePerses';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom-v5-compat';
import { StringParam, useQueryParam } from 'use-query-params';
import { QueryParams } from '../../query-params';

import { DashboardResource } from '@perses-dev/core';
import { useCreateDashboardMutation } from './dashboard-api';
import { createNewDashboard } from './dashboard-utils';
import { useToast } from './ToastProvider';
import { usePerspective, getDashboardUrl } from '../../hooks/usePerspective';
import { usePersesEditPermissions } from './dashboard-toolbar';
import { persesDashboardDataTestIDs } from '../../data-test';
import { checkAccess } from '@openshift-console/dynamic-plugin-sdk';

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
        createResult.status.allowed && updateResult.status.allowed && deleteResult.status.allowed;

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

const useProjectPermissions = (projects: any[]) => {
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
    queryFn: () => checkProjectPermissions(projects),
    enabled: !!projects && projects.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
    onError: (error) => {
      console.warn('Failed to check project permissions:', error);
    },
  });

  const hasEditableProject = editableProjects.length > 0;

  return { editableProjects, hasEditableProject, loading, error };
};

export const DashboardCreateDialog: React.FunctionComponent = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const navigate = useNavigate();
  const { perspective } = usePerspective();
  const { addAlert } = useToast();
  const { persesProjects } = usePerses();
  const [activeProjectFromUrl] = useQueryParam(QueryParams.Project, StringParam);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [dashboardName, setDashboardName] = useState<string>('');
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const createDashboardMutation = useCreateDashboardMutation();

  const { canEdit, loading } = usePersesEditPermissions(activeProjectFromUrl);

  const hookInput = useMemo(() => {
    return persesProjects || [];
  }, [persesProjects]);

  const {
    editableProjects,
    hasEditableProject,
    loading: globalPermissionsLoading,
  } = useProjectPermissions(hookInput);

  const disabled = activeProjectFromUrl ? !canEdit : !hasEditableProject;

  const filteredProjects = useMemo(() => {
    return persesProjects.filter((project) => editableProjects.includes(project.metadata.name));
  }, [persesProjects, editableProjects]);

  useEffect(() => {
    if (
      isModalOpen &&
      filteredProjects &&
      filteredProjects.length > 0 &&
      selectedProject === null
    ) {
      const projectToSelect =
        activeProjectFromUrl &&
        filteredProjects.some((p) => p.metadata.name === activeProjectFromUrl)
          ? activeProjectFromUrl
          : filteredProjects[0].metadata.name;

      setSelectedProject(projectToSelect);
    }
  }, [isModalOpen, filteredProjects, selectedProject, activeProjectFromUrl]);

  const { persesProjectDashboards: dashboards } = usePerses(
    isModalOpen && selectedProject ? selectedProject : undefined,
  );

  const handleSetDashboardName = (_event, dashboardName: string) => {
    setDashboardName(dashboardName);
    if (formErrors.dashboardName) {
      setFormErrors((prev) => ({ ...prev, dashboardName: '' }));
    }
  };

  const handleAdd = async () => {
    setFormErrors({});

    if (!selectedProject || !dashboardName.trim()) {
      const errors: { [key: string]: string } = {};
      if (!selectedProject) errors.project = t('Project is required');
      if (!dashboardName.trim()) errors.dashboardName = t('Dashboard name is required');
      setFormErrors(errors);
      return;
    }

    try {
      if (
        dashboards &&
        dashboards.some(
          (d) =>
            d.metadata.project === selectedProject &&
            d.metadata.name.toLowerCase() === dashboardName.trim().toLowerCase(),
        )
      ) {
        setFormErrors({
          dashboardName: `Dashboard name "${dashboardName}" already exists in this project`,
        });
        return;
      }

      const newDashboard: DashboardResource = createNewDashboard(
        dashboardName.trim(),
        selectedProject as string,
      );

      const createdDashboard = await createDashboardMutation.mutateAsync(newDashboard);

      addAlert(`Dashboard "${dashboardName}" created successfully`, 'success');

      const dashboardUrl = getDashboardUrl(perspective);
      const dashboardParam = `dashboard=${createdDashboard.metadata.name}`;
      const projectParam = `project=${createdDashboard.metadata.project}`;
      const editModeParam = `edit=true`;
      navigate(`${dashboardUrl}?${dashboardParam}&${projectParam}&${editModeParam}`);

      setIsModalOpen(false);
      setDashboardName('');
      setFormErrors({});
    } catch (error) {
      const errorMessage = error?.message || t('Failed to create dashboard. Please try again.');
      addAlert(`Error creating dashboard: ${errorMessage}`, 'danger');
      setFormErrors({ general: errorMessage });
    }
  };

  const handleModalToggle = () => {
    setIsModalOpen(!isModalOpen);
    setIsDropdownOpen(false);
    if (isModalOpen) {
      setDashboardName('');
      setFormErrors({});
    }
  };

  const handleDropdownToggle = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const onFocus = () => {
    const element = document.getElementById('modal-dropdown-toggle');
    (element as HTMLElement)?.focus();
  };

  const onEscapePress = () => {
    if (isDropdownOpen) {
      setIsDropdownOpen(!isDropdownOpen);
      onFocus();
    } else {
      handleModalToggle();
    }
  };

  const onSelect = (
    event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined,
  ) => {
    setSelectedProject(typeof value === 'string' ? value : null);
    setIsDropdownOpen(false);
    onFocus();
  };

  return (
    <>
      <Button
        variant="primary"
        onClick={handleModalToggle}
        isDisabled={disabled || loading || globalPermissionsLoading}
        data-test={persesDashboardDataTestIDs.createDashboardButtonToolbar}
      >
        {loading || globalPermissionsLoading ? t('Loading...') : t('Create')}
      </Button>
      <Modal
        variant={ModalVariant.small}
        isOpen={isModalOpen}
        onClose={handleModalToggle}
        onEscapePress={onEscapePress}
        aria-labelledby="modal-with-dropdown"
      >
        <ModalHeader title={t('Create Dashboard')} />
        <ModalBody>
          {formErrors.general && (
            <Alert
              variant="danger"
              title={formErrors.general}
              isInline
              style={{ marginBottom: '16px' }}
            />
          )}
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              handleAdd();
            }}
          >
            <FormGroup
              label={t('Select project')}
              isRequired
              fieldId="form-group-create-dashboard-dialog-project-selection"
            >
              <Dropdown
                isOpen={isDropdownOpen}
                onSelect={onSelect}
                onOpenChange={(isOpen: boolean) => setIsDropdownOpen(isOpen)}
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle
                    ref={toggleRef}
                    onClick={handleDropdownToggle}
                    isExpanded={isDropdownOpen}
                    isFullWidth
                  >
                    {selectedProject}
                  </MenuToggle>
                )}
              >
                <DropdownList>
                  {filteredProjects.map((project, i) => (
                    <DropdownItem
                      value={`${project.metadata.name}`}
                      key={`${i}-${project.metadata.name}`}
                    >
                      {project.metadata.name}
                    </DropdownItem>
                  ))}
                </DropdownList>
              </Dropdown>
            </FormGroup>
            <FormGroup
              label={t('Dashboard name')}
              isRequired
              fieldId="form-group-create-dashboard-dialog-name"
            >
              <TextInput
                isRequired
                type="text"
                id="text-input-create-dashboard-dialog-name"
                name="text-input-create-dashboard-dialog-name"
                placeholder={t('my-new-dashboard')}
                value={dashboardName}
                onChange={handleSetDashboardName}
                validated={
                  formErrors.dashboardName ? ValidatedOptions.error : ValidatedOptions.default
                }
              />
              {formErrors.dashboardName && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem
                      icon={<ExclamationCircleIcon />}
                      variant={HelperTextItemVariant.error}
                    >
                      {formErrors.dashboardName}
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              )}
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button
            key="create"
            variant="primary"
            onClick={handleAdd}
            isDisabled={
              !dashboardName?.trim() || !selectedProject || createDashboardMutation.isPending
            }
            isLoading={createDashboardMutation.isPending}
          >
            {createDashboardMutation.isPending ? t('Creating...') : t('Create')}
          </Button>
          <Button key="cancel" variant="link" onClick={handleModalToggle}>
            {t('Cancel')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};
