import { StyledComponent } from '@emotion/styled';
import { IconButton, IconButtonProps, styled } from '@mui/material';
import { Theme } from '@mui/material/styles';
import { InfoTooltip } from '@perses-dev/components';
import type { PanelDefinition } from '@perses-dev/core';
import ViewGridPlusIcon from 'mdi-material-ui/ViewGridPlus';
import { FC, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { dashboardsAddPersesPanelExternally } from '@/shared/store/actions';
import type { RootState } from '@/shared/store/store';

export const HeaderIconButton: StyledComponent<IconButtonProps & { theme?: Theme }> = styled(
  IconButton,
)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  padding: '4px',
}));

function createPanelDefinition(query: string, name: string, description: string): PanelDefinition {
  return {
    kind: 'Panel',
    spec: {
      display: {
        name: name,
        description: description,
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

export type AddToDashboardButtonProps = {
  query: string;
  name?: string;
  description?: string;
};

export const AddToDashboardButton: FC<AddToDashboardButtonProps> = ({
  query,
  name,
  description,
}) => {
  const dispatch = useDispatch();
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const isDashboardOpen: boolean = useSelector(
    (s: RootState) => s.plugins?.mcp?.dashboards?.isOpened,
  );
  const addToPersesDashboard = useCallback(() => {
    const panelDefinition = createPanelDefinition(query, name, description);
    dispatch(dashboardsAddPersesPanelExternally(panelDefinition));
  }, [query, name, description, dispatch]);

  if (!isDashboardOpen) {
    // No dashboard is opened - nothing to add to.
    return null;
  }

  return (
    <InfoTooltip description={t('Add To Dashboard')}>
      <HeaderIconButton
        aria-label={t('Add to dashboard')}
        size="small"
        onClick={addToPersesDashboard}
      >
        <ViewGridPlusIcon
          aria-hidden={true}
          fontSize="inherit"
          sx={{ color: (theme) => theme.palette.text.secondary }}
        />
      </HeaderIconButton>
    </InfoTooltip>
  );
};
