import type { FC } from 'react';
import { Navigate, useParams } from 'react-router-dom-v5-compat';
import {
  getAlertRulesUrl,
  getAlertsUrl,
  getEditSilenceAlertUrl,
  getLegacyDashboardsUrl,
  getSilenceAlertUrl,
} from '../hooks/usePerspective';
import { QueryParams } from '../query-params';
import { SilenceResource } from '../utils';

export const DashboardRedirect: FC = () => {
  const pathParams = useParams<{ ns: string }>();

  const queryParams = new URLSearchParams(window.location.search);
  queryParams.append(QueryParams.OpenshiftProject, pathParams.ns);

  const dashboardName = queryParams.get(QueryParams.Dashboard);
  queryParams.delete(QueryParams.Dashboard);

  return <Navigate to={getLegacyDashboardsUrl('admin', dashboardName)} />;
};

export const AlertRedirect: FC = () => {
  const pathParams = useParams<{ ns: string; ruleID: string }>();

  const queryParams = new URLSearchParams(window.location.search);
  queryParams.append(QueryParams.Namespace, pathParams.ns);

  return (
    <Navigate to={`${getAlertsUrl('admin')}/${pathParams.ruleID}?${queryParams.toString()}`} />
  );
};

export const RulesRedirect: FC = () => {
  const pathParams = useParams<{ ns: string; id: string }>();

  const queryParams = new URLSearchParams(window.location.search);
  queryParams.append(QueryParams.Namespace, pathParams.ns);

  return (
    <Navigate to={`${getAlertRulesUrl('admin')}/${pathParams.id}?${queryParams.toString()}`} />
  );
};

export const SilenceRedirect: FC = () => {
  const pathParams = useParams<{ ns: string; id: string }>();

  const queryParams = new URLSearchParams(window.location.search);
  queryParams.append(QueryParams.Namespace, pathParams.ns);

  return (
    <Navigate to={`${getSilenceAlertUrl('admin', pathParams.id)}?${queryParams.toString()}`} />
  );
};

export const SilenceEditRedirect: FC = () => {
  const pathParams = useParams<{ ns: string; id: string }>();

  const queryParams = new URLSearchParams(window.location.search);
  queryParams.append(QueryParams.Namespace, pathParams.ns);

  return (
    <Navigate to={`${getEditSilenceAlertUrl('admin', pathParams.id)}?${queryParams.toString()}`} />
  );
};

export const SilenceNewRedirect: FC = () => {
  const pathParams = useParams<{ ns: string }>();

  const queryParams = new URLSearchParams(window.location.search);
  queryParams.append(QueryParams.Namespace, pathParams.ns);

  return <Navigate to={`${SilenceResource.url}/~new?${queryParams.toString()}`} />;
};

export const MetricsRedirect: FC = () => {
  const pathParams = useParams<{ ns: string }>();

  const queryParams = new URLSearchParams(window.location.search);
  queryParams.append(QueryParams.Namespace, pathParams.ns);

  return <Navigate to={`/monitoring/query-browser?${queryParams.toString()}`} />;
};
