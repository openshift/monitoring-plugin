import { ReactElement, useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useDashboardActions, useDashboardStore } from '@perses-dev/dashboards';
import { dashboardsOpened, dashboardsPersesPanelExternallyAdded } from '@shared/store/actions';
import type { RootState } from '@shared/store/store';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addPersesPanelExternally: any = useSelector(
    (s: RootState) => s.plugins?.mcp?.dashboards?.addPersesPanelExternally,
  );
  const { openAddPanel } = useDashboardActions();
  const dashboardStore = useDashboardStore((state) => state);
  const [queuedPanel, setQueuedPanel] = useState(null);
  // Guard against re-entrant calls: when openAddPanel() or onEditButtonClick()
  // trigger state updates, this effect's dependencies change and it re-runs.
  // Without this ref the effect would call openAddPanel() again, causing
  // React error #185 (Maximum update depth exceeded).
  const processingRef = useRef(false);

  // Turn the dashboard into editable mode and added it to `queuedPanel`.
  // The `queuedPanel` will be added in the next refresh cycle.
  const queuePanelAddition = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    if (addPersesPanelExternally && !queuedPanel && !processingRef.current) {
      processingRef.current = true;
      queuePanelAddition(addPersesPanelExternally);
    }
  }, [queuedPanel, queuePanelAddition, addPersesPanelExternally]);

  useEffect(() => {
    // Apply externally added panel.
    // Wait for panelEditor to be available — openAddPanel() sets it asynchronously
    // via the Zustand store, so it may not exist on the same render cycle.
    if (queuedPanel && dashboardStore.panelEditor) {
      try {
        const panelEditor = dashboardStore.panelEditor;
        const groupId = dashboardStore.panelGroupOrder[0];
        panelEditor.applyChanges({ ...queuedPanel, groupId });
        panelEditor.close();
      } finally {
        setQueuedPanel(null);
        processingRef.current = false;
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
