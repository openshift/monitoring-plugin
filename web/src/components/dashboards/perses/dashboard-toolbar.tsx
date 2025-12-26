import { Stack, Button, Box, useTheme, useMediaQuery, Alert, Tooltip } from '@mui/material';
import { ErrorBoundary, ErrorAlert } from '@perses-dev/components';
import { TimeRangeControls } from '@perses-dev/plugin-system';
import { ReactElement, ReactNode, useCallback, useEffect } from 'react';
import { OnSaveDashboard, useDashboardActions, useEditMode } from '@perses-dev/dashboards';
import { AddPanelButton } from '@perses-dev/dashboards';
import { AddGroupButton } from '@perses-dev/dashboards';
import { DownloadButton } from '@perses-dev/dashboards';
import { EditVariablesButton } from '@perses-dev/dashboards';
import { EditDatasourcesButton } from '@perses-dev/dashboards';
import { EditJsonButton } from '@perses-dev/dashboards';
import { SaveDashboardButton } from '@perses-dev/dashboards';
import { DashboardStickyToolbar } from '@perses-dev/dashboards';

import PencilIcon from 'mdi-material-ui/PencilOutline';
import { StackItem } from '@patternfly/react-core';
import { DashboardDropdown } from '../shared/dashboard-dropdown';
import * as _ from 'lodash-es';
import { useDashboardsData } from './hooks/useDashboardsData';
import { useAccessReview } from '@openshift-console/dynamic-plugin-sdk';
import { useTranslation } from 'react-i18next';

import { persesDashboardDataTestIDs } from '../../data-test';

export interface DashboardToolbarProps {
  dashboardName: string;
  dashboardTitleComponent?: ReactNode;
  initialVariableIsSticky?: boolean;
  isReadonly: boolean;
  isVariableEnabled: boolean;
  isDatasourceEnabled: boolean;
  onEditButtonClick: () => void;
  onCancelButtonClick: () => void;
  onSave?: OnSaveDashboard;
}

export interface EditButtonProps {
  /**
   * The label used inside the button.
   */
  label?: string;

  /**
   * Handler that puts the dashboard into editing mode.
   */
  onClick: () => void;

  /**
   * Whether the button is disabled.
   */
  disabled?: boolean;

  /**
   * Tooltip text to show when button is disabled.
   */
  disabledTooltip?: string;

  /**
   * Whether permissions are still loading.
   */
  loading?: boolean;
}

export const EditButton = ({ onClick }: EditButtonProps): ReactElement => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { canEdit, loading } = usePersesEditPermissions();
  const disabled = !canEdit;

  const button = (
    <Button
      onClick={onClick}
      startIcon={<PencilIcon />}
      variant="outlined"
      color="secondary"
      disabled={disabled || loading}
      sx={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
      data-test={persesDashboardDataTestIDs.editDashboardButtonToolbar}
    >
      {loading ? t('Loading...') : t('Edit')}
    </Button>
  );

  if (disabled && !loading) {
    return (
      <Tooltip title={t("You don't have permission to edit this dashboard")} arrow>
        <span>{button}</span>
      </Tooltip>
    );
  }

  return button;
};

const usePersesEditPermissions = (namespace?: string) => {
  const [canCreate, createLoading] = useAccessReview({
    group: 'perses.dev',
    resource: 'persesdashboards',
    verb: 'create',
    namespace,
  });

  const [canUpdate, updateLoading] = useAccessReview({
    group: 'perses.dev',
    resource: 'persesdashboards',
    verb: 'update',
    namespace,
  });

  const [canDelete, deleteLoading] = useAccessReview({
    group: 'perses.dev',
    resource: 'persesdashboards',
    verb: 'delete',
    namespace,
  });

  const loading = createLoading || updateLoading || deleteLoading;
  const canEdit = canUpdate && canCreate && canDelete;

  return { canEdit, loading };
};

export const OCPDashboardToolbar = (props: DashboardToolbarProps): ReactElement => {
  const {
    initialVariableIsSticky,
    isReadonly,
    isVariableEnabled,
    isDatasourceEnabled,
    onEditButtonClick,
    onCancelButtonClick,
    onSave,
  } = props;

  const { isEditMode } = useEditMode();

  const isBiggerThanSm = useMediaQuery(useTheme().breakpoints.up('sm'));
  const isBiggerThanMd = useMediaQuery(useTheme().breakpoints.up('md'));

  const testId = 'dashboard-toolbar';

  const {
    changeBoard,
    activeProjectDashboardsMetadata: boardItems,
    activeProject,
    dashboardName,
  } = useDashboardsData();

  const { setDashboard } = useDashboardActions();

  const onChangeBoard = useCallback(
    (selectedDashboard: string) => {
      changeBoard(selectedDashboard);

      const selectedBoard = boardItems.find(
        (item) =>
          item.name.toLowerCase() === selectedDashboard.toLowerCase() &&
          item.project?.toLowerCase() === activeProject?.toLowerCase(),
      );

      if (selectedBoard) {
        setDashboard(selectedBoard.persesDashboard);
      }
    },
    [activeProject, boardItems, changeBoard, setDashboard],
  );

  useEffect(() => {
    onChangeBoard(dashboardName);
  }, [dashboardName, onChangeBoard]);

  return (
    <>
      <Stack data-testid={testId}>
        <Box
          px={2}
          py={1.5}
          display="flex"
          sx={{
            backgroundColor: (theme) => theme.palette.primary.main + (isEditMode ? '30' : '0'),
            alignItems: 'center',
          }}
        >
          {!_.isEmpty(boardItems) && (
            <StackItem>
              <DashboardDropdown
                items={boardItems}
                onChange={onChangeBoard}
                selectedKey={dashboardName}
              />
            </StackItem>
          )}
          {isEditMode ? (
            <Stack direction="row" gap={1} ml="auto">
              {isReadonly && (
                <Alert severity="warning" sx={{ backgroundColor: 'transparent', padding: 0 }}>
                  Dashboard managed via code only. Download JSON and commit changes to save.
                </Alert>
              )}
              <Stack direction="row" spacing={0.5} ml={1} whiteSpace="nowrap">
                {isVariableEnabled && <EditVariablesButton />}
                {isDatasourceEnabled && <EditDatasourcesButton />}
                <AddPanelButton />
                <AddGroupButton />
              </Stack>
              <SaveDashboardButton onSave={onSave} isDisabled={isReadonly} />
              <Button
                variant="outlined"
                onClick={onCancelButtonClick}
                data-test={persesDashboardDataTestIDs.cancelButtonToolbar}
              >
                Cancel
              </Button>
            </Stack>
          ) : (
            <>
              {isBiggerThanSm && (
                <Stack direction="row" gap={1} ml="auto">
                  <EditButton onClick={onEditButtonClick} />
                </Stack>
              )}
            </>
          )}
        </Box>
        <Box
          sx={{
            display: 'flex',
            width: '100%',
            alignItems: 'start',
            padding: (theme) => theme.spacing(1, 2, 0, 2),
            flexDirection: isBiggerThanMd ? 'row' : 'column',
            flexWrap: 'nowrap',
            gap: 1,
          }}
        >
          <Box width="100%">
            <ErrorBoundary FallbackComponent={ErrorAlert}>
              <DashboardStickyToolbar
                initialVariableIsSticky={initialVariableIsSticky}
                sx={{
                  backgroundColor: ({ palette }) => palette.background.default,
                }}
              />
            </ErrorBoundary>
          </Box>
          <Stack direction="row" ml="auto" flexWrap="wrap" justifyContent="end">
            <Stack direction="row" spacing={1} mt={1} ml={1}>
              <TimeRangeControls />
              <DownloadButton />
              <EditJsonButton isReadonly={!isEditMode} />
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </>
  );
};
