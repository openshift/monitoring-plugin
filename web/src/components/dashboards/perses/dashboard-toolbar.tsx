import { Alert, Box, Button, Stack, Tooltip, useMediaQuery, useTheme } from '@mui/material';
import { ErrorAlert, ErrorBoundary } from '@perses-dev/components';
import {
  AddGroupButton,
  AddPanelButton,
  DashboardStickyToolbar,
  DownloadButton,
  EditDatasourcesButton,
  EditJsonButton,
  EditVariablesButton,
  OnSaveDashboard,
  SaveDashboardButton,
  useDashboardActions,
  useEditMode,
} from '@perses-dev/dashboards';
import { TimeRangeControls, useTimeZoneParams } from '@perses-dev/plugin-system';
import * as React from 'react';

import { useAccessReview } from '@openshift-console/dynamic-plugin-sdk';
import { StackItem } from '@patternfly/react-core';
import * as _ from 'lodash-es';
import PencilIcon from 'mdi-material-ui/PencilOutline';
import { useTranslation } from 'react-i18next';
import { DashboardDropdown } from '../shared/dashboard-dropdown';
import { useDashboardsData } from './hooks/useDashboardsData';

export interface DashboardToolbarProps {
  dashboardName: string;
  dashboardTitleComponent?: React.ReactNode;
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
   * Handler that puts the dashboard into editing mode.
   */
  onClick: () => void;
  /**
   * The active project/namespace for permissions check.
   */
  activeProject?: string | null;
}

export const EditButton = ({ onClick, activeProject }: EditButtonProps): React.ReactElement => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { canEdit, loading } = usePersesEditPermissions(activeProject);
  const disabled = !canEdit;

  const button = (
    <Button
      onClick={onClick}
      startIcon={<PencilIcon />}
      variant="outlined"
      color="secondary"
      disabled={disabled || loading}
      sx={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
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

export const usePersesEditPermissions = (namespace: string | null = null) => {
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

export const OCPDashboardToolbar = (props: DashboardToolbarProps): React.ReactElement => {
  const {
    initialVariableIsSticky,
    isReadonly,
    isVariableEnabled,
    isDatasourceEnabled,
    onEditButtonClick,
    onCancelButtonClick,
    onSave,
  } = props;

  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { isEditMode } = useEditMode();
  const { timeZone, setTimeZone } = useTimeZoneParams('local');

  const isBiggerThanSm = useMediaQuery(useTheme().breakpoints.up('sm'));
  const isBiggerThanMd = useMediaQuery(useTheme().breakpoints.up('md'));

  const {
    changeBoard,
    activeProjectDashboardsMetadata: boardItems,
    activeProject,
    dashboardName,
  } = useDashboardsData();

  const { setDashboard } = useDashboardActions();

  const onChangeBoard = React.useCallback(
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

  React.useEffect(() => {
    onChangeBoard(dashboardName);
  }, [dashboardName, onChangeBoard]);

  return (
    <>
      <Stack>
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
                  {t('Dashboard managed via code only. Download JSON and commit changes to save.')}
                </Alert>
              )}
              <Stack direction="row" spacing={0.5} ml={1} whiteSpace="nowrap">
                {isVariableEnabled && <EditVariablesButton />}
                {isDatasourceEnabled && <EditDatasourcesButton />}
                <AddPanelButton />
                <AddGroupButton />
              </Stack>
              <SaveDashboardButton onSave={onSave} isDisabled={isReadonly} />
              <Button variant="outlined" onClick={onCancelButtonClick}>
                Cancel
              </Button>
            </Stack>
          ) : (
            <>
              {isBiggerThanSm && (
                <Stack direction="row" gap={1} ml="auto">
                  <EditButton onClick={onEditButtonClick} activeProject={activeProject} />
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
              <TimeRangeControls
                timeZone={timeZone}
                onTimeZoneChange={(tz) => setTimeZone(tz.value)}
              />
              <DownloadButton />
              <EditJsonButton isReadonly={!isEditMode} />
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </>
  );
};
