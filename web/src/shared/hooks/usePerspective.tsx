import { PrometheusAlert, Rule, useActivePerspective } from '@openshift-console/dynamic-plugin-sdk';
import * as _ from 'lodash-es';

import { QueryParams } from '@/shared/constants/query-params';
import { MonitoringState } from '@/shared/store/store';
import { AlertSource } from '@/shared/types/types';
import { GraphUnits } from '@/shared/utils/units';
import {
  ALERTMANAGER_BASE_PATH,
  ALERTMANAGER_PROXY_PATH,
  ALERTMANAGER_TENANCY_BASE_PATH,
  AlertResource,
  labelsToParams,
  MonitoringPlugins,
  RuleResource,
  SilenceResource,
} from '@/shared/utils/utils';

export type Perspective = 'admin' | 'dev' | 'acm' | 'virtualization-perspective';

export const PerspectiveName = {
  Admin: 'admin',
  Developer: 'dev',
  ACM: 'acm',
  Virtualization: 'virtualization-perspective',
} as const satisfies Record<string, Perspective>;

export type CustomerPerspective =
  | 'Core platform'
  | 'Administrator'
  | 'Developer'
  | 'Fleet management'
  | 'Fleet virtualization'
  | 'Virtualization';

export const CustomerPerspectiveName = {
  CorePlatform: 'Core platform',
  Administrator: 'Administrator',
  Developer: 'Developer',
  FleetManagement: 'Fleet management',
  FleetVirtualization: 'Fleet virtualization',
  Virtualization: 'Virtualization',
} as const satisfies Record<string, CustomerPerspective>;

export type UrlRoot = 'monitoring' | 'dev-monitoring' | 'multicloud/monitoring' | 'virt-monitoring';

export const UrlRootName = {
  [PerspectiveName.Admin]: 'monitoring',
  [PerspectiveName.Developer]: 'dev-monitoring',
  [PerspectiveName.Virtualization]: 'virt-monitoring',
  [PerspectiveName.ACM]: 'multicloud/monitoring',
} as const satisfies Record<Perspective, UrlRoot>;

type usePerspectiveReturn = {
  perspective: Perspective;
  customerPerspective: CustomerPerspective;
  urlRoot: UrlRoot;
  defaultAlertTenant: Array<AlertSource>;
};

export const usePerspective = (): usePerspectiveReturn => {
  const [perspective] = useActivePerspective();

  switch (perspective) {
    case PerspectiveName.Developer:
      return {
        perspective: PerspectiveName.Developer,
        customerPerspective: getCustomerFacingPerspectiveName(PerspectiveName.Developer),
        urlRoot: UrlRootName[PerspectiveName.Developer],
        defaultAlertTenant: [AlertSource.User],
      };
    case PerspectiveName.Admin:
      return {
        perspective: PerspectiveName.Admin,
        customerPerspective: getCustomerFacingPerspectiveName(PerspectiveName.Admin),
        urlRoot: UrlRootName[PerspectiveName.Admin],
        defaultAlertTenant: [AlertSource.Platform],
      };
    case PerspectiveName.Virtualization:
      return {
        perspective: PerspectiveName.Virtualization,
        customerPerspective: getCustomerFacingPerspectiveName(PerspectiveName.Virtualization),
        urlRoot: UrlRootName[PerspectiveName.Virtualization],
        defaultAlertTenant: [AlertSource.Platform],
      };
    default:
      return {
        perspective: PerspectiveName.ACM,
        customerPerspective: getCustomerFacingPerspectiveName(PerspectiveName.ACM),
        urlRoot: UrlRootName[PerspectiveName.ACM],
        defaultAlertTenant: [],
      };
  }
};

export const getCustomerFacingPerspectiveName = (perspective: Perspective): CustomerPerspective => {
  switch (perspective) {
    case PerspectiveName.Developer:
      return CustomerPerspectiveName.Developer;
    case PerspectiveName.ACM:
      return CustomerPerspectiveName.FleetManagement;
    case PerspectiveName.Virtualization:
      return CustomerPerspectiveName.Virtualization;
    case PerspectiveName.Admin:
    default:
      return CustomerPerspectiveName.CorePlatform;
  }
};

export const getAlertsUrl = (perspective: Perspective, namespace?: string) => {
  switch (perspective) {
    case PerspectiveName.ACM:
      return `/multicloud${AlertResource.url}`;
    case PerspectiveName.Developer:
      return `/dev-monitoring/ns/${namespace}/alerts`;
    case PerspectiveName.Virtualization:
      return AlertResource.virtUrl;
    case PerspectiveName.Admin:
    default:
      return AlertResource.url;
  }
};

export const getAlertRulesUrl = (perspective: Perspective, namespace?: string) => {
  switch (perspective) {
    case PerspectiveName.ACM:
      return `/multicloud${RuleResource.url}`;
    case PerspectiveName.Developer:
      return `/dev-monitoring/ns/${namespace}/alertrules`;
    case PerspectiveName.Virtualization:
      return RuleResource.virtUrl;
    case PerspectiveName.Admin:
    default:
      return RuleResource.url;
  }
};

export const getSilencesUrl = (perspective: Perspective, namespace?: string) => {
  switch (perspective) {
    case PerspectiveName.ACM:
      return `/multicloud${SilenceResource.url}`;
    case PerspectiveName.Developer:
      return `/dev-monitoring/ns/${namespace}/silences`;
    case PerspectiveName.Virtualization:
      return SilenceResource.virtUrl;
    case PerspectiveName.Admin:
    default:
      return SilenceResource.url;
  }
};

export const getNewSilenceAlertUrl = (
  perspective: Perspective,
  alert: PrometheusAlert,
  namespace?: string,
) => {
  switch (perspective) {
    case PerspectiveName.ACM:
      return `/multicloud${SilenceResource.url}/~new?${labelsToParams(alert.labels)}`;
    case PerspectiveName.Developer:
      return `/dev-monitoring/ns/${namespace}/silences/~new?${labelsToParams(alert.labels)}`;
    case PerspectiveName.Virtualization:
      return `${SilenceResource.virtUrl}/~new?${labelsToParams(alert.labels)}`;
    case PerspectiveName.Admin:
    default:
      return `${SilenceResource.url}/~new?${labelsToParams(alert.labels)}`;
  }
};

export const getNewSilenceUrl = (perspective: Perspective, namespace?: string) => {
  switch (perspective) {
    case PerspectiveName.ACM:
      return `/multicloud${SilenceResource.url}/~new`;
    case PerspectiveName.Developer:
      return `/dev-monitoring/ns/${namespace}/silences/~new`;
    case PerspectiveName.Virtualization:
      return `${SilenceResource.virtUrl}/~new`;
    case PerspectiveName.Admin:
    default:
      return `${SilenceResource.url}/~new`;
  }
};

export const getRuleUrl = (perspective: Perspective, rule: Rule, namespace?: string) => {
  switch (perspective) {
    case PerspectiveName.ACM:
      return `/multicloud${RuleResource.url}/${_.get(rule, 'id')}`;
    case PerspectiveName.Developer:
      return `/dev-monitoring/ns/${namespace}/rules/${rule?.id}`;
    case PerspectiveName.Virtualization:
      return `${RuleResource.virtUrl}/${rule?.id}`;
    case PerspectiveName.Admin:
    default:
      return `${RuleResource.url}/${_.get(rule, 'id')}`;
  }
};

export const getSilenceAlertUrl = (perspective: Perspective, id: string, namespace?: string) => {
  switch (perspective) {
    case PerspectiveName.ACM:
      return `/multicloud${SilenceResource.url}/${id}`;
    case PerspectiveName.Developer:
      return `/dev-monitoring/ns/${namespace}/silences/${id}`;
    case PerspectiveName.Virtualization:
      return `${SilenceResource.virtUrl}/${id}`;
    case PerspectiveName.Admin:
    default:
      return `${SilenceResource.url}/${id}`;
  }
};

export const getEditSilenceAlertUrl = (
  perspective: Perspective,
  id: string,
  namespace?: string,
) => {
  switch (perspective) {
    case PerspectiveName.ACM:
      return `/multicloud${SilenceResource.url}/${id}/edit`;
    case PerspectiveName.Developer:
      return `/dev-monitoring/ns/${namespace}/silences/${id}/edit`;
    case PerspectiveName.Virtualization:
      return `${SilenceResource.virtUrl}/${id}/edit`;
    case PerspectiveName.Admin:
    default:
      return `${SilenceResource.url}/${id}/edit`;
  }
};

export const getAlertUrl = (
  perspective: Perspective,
  alert: PrometheusAlert,
  ruleID: string,
  namespace?: string,
) => {
  switch (perspective) {
    case PerspectiveName.ACM:
      return `/multicloud${AlertResource.url}/${ruleID}?${labelsToParams(alert.labels)}`;
    case PerspectiveName.Developer:
      return `/dev-monitoring/ns/${namespace}/alerts/${ruleID}?${labelsToParams(alert.labels)}`;
    case PerspectiveName.Virtualization:
      return `${AlertResource.virtUrl}/${ruleID}?${labelsToParams(alert.labels)}`;
    case PerspectiveName.Admin:
    default:
      return `${AlertResource.url}/${ruleID}?${labelsToParams(alert.labels)}`;
  }
};

export const getFetchSilenceUrl = (
  perspective: Perspective,
  silenceID: string,
  namespace?: string,
) => {
  switch (perspective) {
    case PerspectiveName.ACM:
      return `${ALERTMANAGER_PROXY_PATH}/api/v2/silence/${silenceID}`;
    case PerspectiveName.Developer:
      return `${ALERTMANAGER_TENANCY_BASE_PATH}/api/v2/silence/${silenceID}?namespace=${namespace}`;
    case PerspectiveName.Virtualization:
      return `${ALERTMANAGER_BASE_PATH}/api/v2/silence/${silenceID}`;
    default:
    case PerspectiveName.Admin:
      return `${ALERTMANAGER_BASE_PATH}/api/v2/silence/${silenceID}`;
  }
};

// Redux state defined in the openshift/console repo
export const getObserveState = (plugin: MonitoringPlugins, state: MonitoringState) => {
  switch (plugin) {
    case 'monitoring-console-plugin':
      return state.plugins?.mcp;
    case 'monitoring-plugin':
    default:
      return state.plugins?.mp;
  }
};

export const getQueryBrowserUrl = ({
  perspective,
  query,
  namespace,
  units,
}: {
  perspective: Perspective;
  query: string;
  namespace?: string;
  units?: GraphUnits;
}) => {
  const unitsQueryParam = units ? `&${QueryParams.Units}=${units}` : '';
  switch (perspective) {
    case PerspectiveName.ACM:
      return '';
    case PerspectiveName.Developer:
      return `/dev-monitoring/ns/${namespace}/metrics?query0=${encodeURIComponent(
        query,
      )}${unitsQueryParam}`;
    case PerspectiveName.Virtualization:
      return `/virt-monitoring/query-browser?query0=${encodeURIComponent(query)}${unitsQueryParam}`;
    case PerspectiveName.Admin:
    default:
      return `/monitoring/query-browser?query0=${encodeURIComponent(query)}${unitsQueryParam}`;
  }
};

export const getMutlipleQueryBrowserUrl = (
  perspective: Perspective,
  params: URLSearchParams,
  namespace?: string,
) => {
  switch (perspective) {
    case PerspectiveName.ACM:
      return '';
    case PerspectiveName.Developer:
      return `/dev-monitoring/ns/${namespace}/metrics?${params.toString()}`;
    case PerspectiveName.Virtualization:
      return `/virt-monitoring/query-browser?${params.toString()}`;
    case PerspectiveName.Admin:
    default:
      return `/monitoring/query-browser?${params.toString()}`;
  }
};

export const getLegacyDashboardsUrl = (
  perspective: Perspective,
  boardName?: string,
  namespace?: string,
) => {
  switch (perspective) {
    case PerspectiveName.ACM:
      return '';
    case PerspectiveName.Developer:
      return `/dev-monitoring/ns/${namespace}`;
    case PerspectiveName.Virtualization:
      return `/virt-monitoring/dashboards` + (boardName ? `/${boardName}` : '');
    case PerspectiveName.Admin:
    default:
      return `/monitoring/dashboards` + (boardName ? `/${boardName}` : '');
  }
};

export const getDashboardUrl = (perspective: Perspective) => {
  switch (perspective) {
    case PerspectiveName.Virtualization:
      return `/virt-monitoring/v2/dashboards/view`;
    case PerspectiveName.Admin:
      return `/monitoring/v2/dashboards/view`;
    case PerspectiveName.ACM:
      return `/multicloud/monitoring/v2/dashboards/view`;
    default:
      return '';
  }
};

export const getDashboardsListUrl = (perspective: Perspective) => {
  switch (perspective) {
    case PerspectiveName.Virtualization:
      return `/virt-monitoring/v2/dashboards`;
    case PerspectiveName.Admin:
      return `/monitoring/v2/dashboards`;
    case PerspectiveName.ACM:
      return `/multicloud/monitoring/v2/dashboards`;
    default:
      return '';
  }
};
