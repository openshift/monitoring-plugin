import * as React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom-v5-compat';
import { usePerspective } from './hooks/usePerspective';

// Redirects AlertManager configuration pages from the monitoring namespace to settings:
// FROM: /monitoring/alertmanagerconfig → TO: /settings/cluster/alertmanagerconfig
// FROM: /monitoring/alertmanageryaml → TO: /settings/cluster/alertmanageryaml
// This redirect is needed because the console owns these pages (OCPBUGS-59772)
const AlertManagerRedirect: React.FC = () => {
  const { urlRoot } = usePerspective();

  const pathSegments = window.location.pathname.split('/');
  const alertManagerConfigPath = pathSegments[pathSegments.length - 1] || '';

  const [searchParams] = useSearchParams();
  const queryString = searchParams.toString();

  const redirectUrl = `/${urlRoot}/settings/cluster/${alertManagerConfigPath}${
    queryString ? `?${queryString}` : ''
  }`;

  return <Navigate to={redirectUrl} replace={true} />;
};

export default AlertManagerRedirect;
