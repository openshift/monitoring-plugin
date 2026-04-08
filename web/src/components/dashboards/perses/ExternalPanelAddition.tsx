import { ReactElement, useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useDashboardActions, useDashboardStore } from '@perses-dev/dashboards';
import { dashboardsOpened, dashboardsPersesPanelExternallyAdded } from '../../../store/actions';

interface ExternalPanelAdditionProps {
  isEditMode: boolean;
  onEditButtonClick: () => void;
}

// Effect-only component that registers hooks related to exposing adding panels
// from external intergrations.
// See components/ols-tool-ui/helpers/AddToDashboardButton.tsx for example use.
export function ExternalPanelAddition({
  isEditMode,
  onEditButtonClick,
}: ExternalPanelAdditionProps): ReactElement | null {
  const dispatch = useDispatch();
  const addPersesPanelExternally: any = useSelector(
    (s: any) => s.plugins?.mcp?.dashboards?.addPersesPanelExternally,
  );
  const { openAddPanel } = useDashboardActions();
  const dashboardStore = useDashboardStore();
  const [externallyAddedPanel, setExternallyAddedPanel] = useState(null);

  const addPanelExternally = useCallback(
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
      setExternallyAddedPanel(change);
    },
    [isEditMode, onEditButtonClick, openAddPanel],
  );

  useEffect(() => {
    // Listen for external panel addition requests
    if (addPersesPanelExternally) {
      addPanelExternally(addPersesPanelExternally);
      dispatch(dashboardsPersesPanelExternallyAdded());
    }

    // Apply externally added panel
    if (externallyAddedPanel) {
      const groupId = dashboardStore.panelGroupOrder[0];
      externallyAddedPanel.groupId = groupId;

      // Use the temporary panelEditor to add changes to the dashboard.
      const panelEditor = dashboardStore.panelEditor;
      panelEditor.applyChanges(externallyAddedPanel);
      panelEditor.close();

      // Clear the externally added panel after applying changes
      setExternallyAddedPanel(null);
    }
  }, [
    dispatch,
    dashboardStore.panelGroupOrder,
    dashboardStore.panelEditor,
    externallyAddedPanel,
    addPanelExternally,
    addPersesPanelExternally,
  ]);

  // Advertise when a dashboard is opened/closed
  useEffect(() => {
    dispatch(dashboardsOpened(true));
    return () => {
      dispatch(dashboardsOpened(false));
    };
  }, [dispatch]);

  return null;
}
