import { ReactElement, useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useDashboardActions, useDashboardStore } from '@perses-dev/dashboards';
import { dashboardsOpened, dashboardsPersesPanelExternallyAdded } from '../../../store/actions';
import type { RootState } from '../../../store/store';

interface ExternalPanelAdditionProps {
  isEditMode: boolean;
  onEditButtonClick: () => void;
}

// Effect-only component that registers hooks related to exposing adding panels
// from external integrations.
// See components/ols-tool-ui/helpers/AddToDashboardButton.tsx for example use.
export function ExternalPanelAddition({
  isEditMode,
  onEditButtonClick,
}: ExternalPanelAdditionProps): ReactElement | null {
  const dispatch = useDispatch();
  const addPersesPanelExternally: any = useSelector(
    (s: RootState) => s.plugins?.mcp?.dashboards?.addPersesPanelExternally,
  );
  const { openAddPanel } = useDashboardActions();
  const dashboardStore = useDashboardStore((state) => state);
  const [queuedPanel, setQueuedPanel] = useState(null);

  // Turn the dashboard into editable mode and added it to `queuedPanel`.
  // The `queuedPanel` will be added in the next refresh cycle.
  const queuePanelAddition = useCallback(
    (panelDefinition: any): void => {
      // Simulate opening a panel to add the pane so that we can use it to programatically
      // add a panel to the dashboard from an external source (AI assistant).
      if (!isEditMode) {
        onEditButtonClick();
      }
      openAddPanel();
      // Wrap the panelDefinition with the groupId structure
      const change = {
        groupId: 0,
        panelDefinition,
      };
      setQueuedPanel(change);
    },
    [isEditMode, onEditButtonClick, openAddPanel],
  );

  useEffect(() => {
    // Listen for external panel addition requests
    if (addPersesPanelExternally && !queuedPanel) {
      queuePanelAddition(addPersesPanelExternally);
    }
  }, [queuedPanel, queuePanelAddition, addPersesPanelExternally]);

  useEffect(() => {
    // Apply externally added panel
    if (queuedPanel) {
      try {
        // Use the temporary panelEditor to add changes to the dashboard.
        const panelEditor = dashboardStore.panelEditor;
        const groupId = dashboardStore.panelGroupOrder[0];
        panelEditor.applyChanges({ ...queuedPanel, groupId });
        panelEditor.close();
      } finally {
        // Clear the externally added panel after applying changes.
        // We assume only one panel is being added in one cycle: no need to complicate
        // with multiple panels in the queue.
        // We make sure we clean up even on error to avoid endless loops.
        setQueuedPanel(null);
        dispatch(dashboardsPersesPanelExternallyAdded());
      }
    }
  }, [dispatch, dashboardStore.panelGroupOrder, dashboardStore.panelEditor, queuedPanel]);

  // Advertise when a dashboard is opened/closed
  useEffect(() => {
    dispatch(dashboardsOpened(true));
    return () => {
      dispatch(dashboardsOpened(false));
    };
  }, [dispatch]);

  return null;
}
