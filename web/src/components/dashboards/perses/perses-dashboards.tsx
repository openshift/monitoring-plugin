import React from 'react';
import { combineSx } from '@perses-dev/components';
import { Box } from '@mui/material';
import { Dashboard } from '@perses-dev/dashboards';
import { useTranslation } from 'react-i18next';

/**
 * This component is what we use to integrate perses into the openshift console
 * It is a combinatoin of the ViewDashboard & DashboardApp components in the perses
 * codebase. We can't use those components directly as they come bundled with the
 * Dashboard toolbar, and are overall not needed for the non-editable dashboards.
 * As we look to implement customizable dashboards we should look to remove the
 * required DashboardsToolbar (as we will be providing our own)
 */

function PersesBoard() {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Box
      sx={combineSx(
        {
          display: 'flex',
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
        },
        {},
      )}
    >
      <Box sx={{ paddingTop: 2, paddingX: 2, height: '100%', width: '100%' }}>
        <Dashboard
          emptyDashboardProps={{
            title: t('Empty Dashboard'),
            description: t('To get started add something to your dashboard'),
          }}
        />
      </Box>
    </Box>
  );
}

export default PersesBoard;
