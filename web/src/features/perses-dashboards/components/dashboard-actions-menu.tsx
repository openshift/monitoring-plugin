import {
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  MenuToggleAction,
  MenuToggleElement,
  Tooltip,
} from '@patternfly/react-core';
import { FC, Ref, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DashboardCreateDialog } from '@/features/perses-dashboards/components/dashboard-create-dialog';
import { DashboardImportDialog } from '@/features/perses-dashboards/components/dashboard-import-dialog';
import { useEditableProjects } from '@/features/perses-dashboards/hooks/useEditableProjects';
import { persesDashboardDataTestIDs } from '@/shared/constants/data-test';

export const DashboardActionsMenu: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { hasEditableProject, permissionsLoading } = useEditableProjects();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const disabled = permissionsLoading || !hasEditableProject;

  const handleCreateClick = () => {
    setIsCreateModalOpen(true);
    setIsDropdownOpen(false);
  };

  const handleImportClick = () => {
    setIsImportModalOpen(true);
    setIsDropdownOpen(false);
  };

  const onToggleClick = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const onSelect = () => {
    setIsDropdownOpen(false);
  };

  const splitButton = (
    <Dropdown
      isOpen={isDropdownOpen}
      onSelect={onSelect}
      onOpenChange={(open: boolean) => setIsDropdownOpen(open)}
      toggle={(toggleRef: Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          variant="primary"
          splitButtonItems={[
            <MenuToggleAction
              key="create-action"
              onClick={handleCreateClick}
              isDisabled={disabled}
              data-test={persesDashboardDataTestIDs.createDashboardButtonToolbar}
            >
              {permissionsLoading ? t('Checking permissions...') : t('Create')}
            </MenuToggleAction>,
          ]}
          onClick={onToggleClick}
          isExpanded={isDropdownOpen}
          isDisabled={disabled}
          aria-label={t('Dashboard actions')}
        />
      )}
    >
      <DropdownList>
        <DropdownItem
          key="import"
          onClick={handleImportClick}
          data-test={persesDashboardDataTestIDs.importDashboardButtonToolbar}
        >
          {t('Import')}
        </DropdownItem>
      </DropdownList>
    </Dropdown>
  );

  return (
    <>
      {!permissionsLoading && !hasEditableProject ? (
        <Tooltip
          content={t('To create dashboards, contact your cluster administrator for permission.')}
        >
          <span style={{ cursor: 'not-allowed' }}>{splitButton}</span>
        </Tooltip>
      ) : (
        splitButton
      )}
      <DashboardCreateDialog
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
      <DashboardImportDialog
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </>
  );
};
