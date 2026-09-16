import { useState } from 'react';
import {
  Dropdown,
  DropdownList,
  DropdownItem,
  MenuToggle,
  MenuToggleElement,
  MenuToggleAction,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { DashboardCreateDialog } from './dashboard-create-dialog';
import { DashboardImportDialog } from './dashboard-import-dialog';
import { persesDashboardDataTestIDs } from '../../data-test';

export const DashboardActionsMenu: React.FunctionComponent = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

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
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          variant="primary"
          splitButtonItems={[
            <MenuToggleAction
              key="create-action"
              onClick={handleCreateClick}
              data-test={persesDashboardDataTestIDs.createDashboardButtonToolbar}
            >
              {t('Create')}
            </MenuToggleAction>,
          ]}
          onClick={onToggleClick}
          isExpanded={isDropdownOpen}
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
      {splitButton}
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
