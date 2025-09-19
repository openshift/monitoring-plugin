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
    <Dashboard
      emptyDashboardProps={{
        title: t('Empty Dashboard'),
        description: t('To get started add something to your dashboard'),
      }}
    />
  );
}

export default PersesBoard;
