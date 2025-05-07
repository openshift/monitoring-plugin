import * as React from 'react';
import { Navigate } from 'react-router-dom-v5-compat';
import { getAllQueryArguments } from './console/utils/router';
import { usePerspective } from './hooks/usePerspective';

// Handles links that have the Prometheus UI's URL format (expected for links in alerts sent by
// Alertmanager). The Prometheus UI specifies the PromQL query with the GET param `g0.expr`, so we
// use that if it exists. Otherwise, just go to the query browser page with no query.
const PrometheusRouterRedirect: React.FC = () => {
  const { urlRoot } = usePerspective();

  const params = getAllQueryArguments();
  // leaving perspective redirect to future work
  return <Navigate to={`/${urlRoot}/query-browser?query0=${params['g0.expr'] || ''}`} />;
};

export default PrometheusRouterRedirect;
