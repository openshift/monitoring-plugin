import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { PanelDefinition } from '@perses-dev/core';
import { Button } from '@patternfly/react-core';
import { dashboardsAddPersesPanelExternally } from '../../store/actions';

function createPanelDefinition(query: string): PanelDefinition {
  return {
    kind: 'Panel',
    spec: {
      display: {
        name: query,
      },
      plugin: {
        kind: 'TimeSeriesChart',
        spec: {},
      },
      queries: [
        {
          kind: 'TimeSeriesQuery',
          spec: {
            plugin: {
              kind: 'PrometheusTimeSeriesQuery',
              spec: {
                query: query,
              },
            },
          },
        },
      ],
    },
  };
}

type AddToDashboardButtonProps = {
  query: string;
};

export const AddToDashboardButton: React.FC<AddToDashboardButtonProps> = ({ query }) => {
  const dispatch = useDispatch();

  const isCustomDashboardOpen: boolean = useSelector(
    (s: any) => s.plugins?.mp?.dashboards?.isOpened,
  );

  const addToPersesDashboard = React.useCallback(() => {
    const panelDefinition = createPanelDefinition(query);
    dispatch(dashboardsAddPersesPanelExternally(panelDefinition));
  }, [query, dispatch]);

  if (!isCustomDashboardOpen) {
    return null;
  }

  return <Button onClick={addToPersesDashboard}>Add to dashboard</Button>;
};
