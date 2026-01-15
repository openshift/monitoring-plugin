import { useEffect, useState } from 'react';
import {
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
} from '@patternfly/react-core';
import { usePerses } from './hooks/usePerses';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom-v5-compat';

import { DashboardResource } from '@perses-dev/core';
import { useCreateDashboardMutation } from './dashboard-api';
import { createNewDashboard } from './dashboard-utils';
import { useToast } from './ToastProvider';
import { usePerspective, getDashboardUrl } from '../../hooks/usePerspective';
import { t_color_red_50 } from '@patternfly/react-tokens';
import { usePersesEditPermissions } from './dashboard-toolbar';
import { persesDashboardDataTestIDs } from '../../data-test';

export const DashboardCreateDialog: React.FunctionComponent = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const navigate = useNavigate();
  const { perspective } = usePerspective();
  const { addAlert } = useToast();
  const { canEdit, loading } = usePersesEditPermissions();
  const disabled = !canEdit;

  const { persesProjects } = usePerses();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [dashboardName, setDashboardName] = useState<string>('');
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const createDashboardMutation = useCreateDashboardMutation();

  useEffect(() => {
    if (persesProjects && persesProjects.length > 0 && selectedProject === null) {
      setSelectedProject(persesProjects[0].metadata.name);
    }
  }, [persesProjects, selectedProject]);

  const { persesProjectDashboards: dashboards } = usePerses(selectedProject || undefined);

  const warningColor = t_color_red_50.value;

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
      if (!selectedProject) errors.project = 'Project is required';
      if (!dashboardName.trim()) errors.dashboardName = 'Dashboard name is required';
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
        isDisabled={disabled || loading}
        data-test={persesDashboardDataTestIDs.createDashboardButtonToolbar}
      >
        {loading ? t('Loading...') : t('Create')}
      </Button>
      <Modal
        variant={ModalVariant.small}
        isOpen={isModalOpen}
        onClose={handleModalToggle}
        onEscapePress={onEscapePress}
        aria-labelledby="modal-with-dropdown"
      >
        <ModalHeader title="Create Dashboard" />
        <ModalBody>
          {formErrors.general && (
            <div style={{ marginBottom: '16px', color: 'var(--pf-global--danger-color--100)' }}>
              {formErrors.general}
            </div>
          )}
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              handleAdd();
            }}
          >
            <FormGroup
              label="Select project"
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
                  {persesProjects.map((project, i) => (
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
              label="Dashboard name"
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
              />
              {formErrors.dashboardName && (
                <div
                  style={{
                    color: warningColor,
                    fontSize: '14px',
                    marginTop: '4px',
                  }}
                >
                  {formErrors.dashboardName}
                </div>
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
            {createDashboardMutation.isPending ? 'Creating...' : 'Create'}
          </Button>
          <Button key="cancel" variant="link" onClick={handleModalToggle}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};
