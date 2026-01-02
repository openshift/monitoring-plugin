import { PrometheusAlert, Rule, useActivePerspective } from '@openshift-console/dynamic-plugin-sdk';
import { Perspective } from '../../store/actions';
import { AlertSource } from '../types';
import * as _ from 'lodash-es';
import {
  ALERTMANAGER_BASE_PATH,
  ALERTMANAGER_PROXY_PATH,
  AlertResource,
  labelsToParams,
  MonitoringPlugins,
  RuleResource,
  SilenceResource,
} from '../utils';
import { GraphUnits } from '../metrics/units';
import { QueryParams } from '../query-params';
import { MonitoringState } from 'src/store/store';

export type UrlRoot = 'monitoring' | 'dev-monitoring' | 'multicloud/monitoring' | 'virt-monitoring';

const enum UrlRecord {
  admin = 'monitoring',
  dev = 'dev-monitoring',
  'virtualization-perspective' = 'virt-monitoring',
  acm = 'multicloud/monitoring',
}

type usePerspectiveReturn = {
  perspective: Perspective;
  urlRoot: UrlRoot;
  defaultAlertTenant: Array<AlertSource>;
};

export const usePerspective = (): usePerspectiveReturn => {
  const [perspective] = useActivePerspective();

  switch (perspective) {
    case 'dev':
      return {
        perspective: 'dev',
        urlRoot: UrlRecord.dev,
        defaultAlertTenant: [AlertSource.User],
      };
    case 'admin':
      return {
        perspective: 'admin',
        urlRoot: UrlRecord.admin,
        defaultAlertTenant: [AlertSource.Platform],
      };
    case 'virtualization-perspective':
      return {
        perspective: 'virtualization-perspective',
        urlRoot: UrlRecord['virtualization-perspective'],
        defaultAlertTenant: [AlertSource.Platform],
      };
    default:
      return {
        perspective: 'acm',
        urlRoot: UrlRecord.acm,
        defaultAlertTenant: [],
      };
  }
};

export const getAlertsUrl = (perspective: Perspective) => {
  switch (perspective) {
    case 'acm':
      return `/multicloud${AlertResource.url}`;
    case 'virtualization-perspective':
      return `/virt-monitoring/alerts`;
    case 'admin':
    default:
      return AlertResource.url;
  }
};

// There is no equivalent rules list page in the developer perspective
export const getAlertRulesUrl = (perspective: Perspective) => {
  switch (perspective) {
    case 'acm':
      return `/multicloud${RuleResource.url}`;
    case 'virtualization-perspective':
      return `/virt-monitoring/alertrules`;
    case 'admin':
    default:
      return RuleResource.url;
  }
};

export const getSilencesUrl = (perspective: Perspective) => {
  switch (perspective) {
    case 'acm':
      return `/multicloud${SilenceResource.url}`;
    case 'virtualization-perspective':
      return `/virt-monitoring/silences`;
    case 'admin':
    default:
      return SilenceResource.url;
  }
};

export const getNewSilenceAlertUrl = (perspective: Perspective, alert: PrometheusAlert) => {
  switch (perspective) {
    case 'acm':
      return `/multicloud${SilenceResource.url}/~new?${labelsToParams(alert.labels)}`;
    case 'virtualization-perspective':
      return `/virt-monitoring/silences/~new?${labelsToParams(alert.labels)}`;
    case 'admin':
    default:
      return `${SilenceResource.url}/~new?${labelsToParams(alert.labels)}`;
  }
};

export const getNewSilenceUrl = (perspective: Perspective) => {
  switch (perspective) {
    case 'acm':
      return `/multicloud${SilenceResource.url}/~new`;
    case 'virtualization-perspective':
      return `/virt-monitoring/silences/~new`;
    case 'admin':
    default:
      return `${SilenceResource.url}/~new`;
  }
};

export const getRuleUrl = (perspective: Perspective, rule: Rule) => {
  switch (perspective) {
    case 'acm':
      return `/multicloud${RuleResource.url}/${_.get(rule, 'id')}`;
    case 'virtualization-perspective':
      return `/virt-monitoring/alertrules/${rule?.id}`;
    case 'admin':
    default:
      return `${RuleResource.url}/${_.get(rule, 'id')}`;
  }
};

export const getSilenceAlertUrl = (perspective: Perspective, id: string) => {
  switch (perspective) {
    case 'acm':
      return `/multicloud${SilenceResource.url}/${id}`;
    case 'virtualization-perspective':
      return `/virt-monitoring/silences/${id}`;
    case 'admin':
    default:
      return `${SilenceResource.url}/${id}`;
  }
};

export const getEditSilenceAlertUrl = (perspective: Perspective, id: string) => {
  switch (perspective) {
    case 'acm':
      return `/multicloud${SilenceResource.url}/${id}/edit`;
    case 'virtualization-perspective':
      return `/virt-monitoring/silences/${id}/edit`;
    case 'admin':
    default:
      return `${SilenceResource.url}/${id}/edit`;
  }
};

export const getAlertUrl = (perspective: Perspective, alert: PrometheusAlert, ruleID: string) => {
  switch (perspective) {
    case 'acm':
      return `/multicloud${AlertResource.url}/${ruleID}?${labelsToParams(alert.labels)}`;
    case 'virtualization-perspective':
      return `/virt-monitoring/alerts/${ruleID}?${labelsToParams(alert.labels)}`;
    case 'admin':
    default:
      return `${AlertResource.url}/${ruleID}?${labelsToParams(alert.labels)}`;
  }
};

export const getFetchSilenceUrl = (perspective: Perspective, silenceID: string) => {
  switch (perspective) {
    case 'acm':
      return `${ALERTMANAGER_PROXY_PATH}/api/v2/silence/${silenceID}`;
    case 'virtualization-perspective':
      return `${ALERTMANAGER_BASE_PATH}/api/v2/silence/${silenceID}`;
    default:
    case 'admin':
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
  units,
}: {
  perspective: Perspective;
  query: string;
  units?: GraphUnits;
}) => {
  const unitsQueryParam = units ? `&${QueryParams.Units}=${units}` : '';
  switch (perspective) {
    case 'virtualization-perspective':
      return `/virt-monitoring/query-browser?query0=${encodeURIComponent(query)}${unitsQueryParam}`;
    case 'acm':
      return '';
    case 'admin':
    default:
      return `/monitoring/query-browser?query0=${encodeURIComponent(query)}${unitsQueryParam}`;
  }
};

export const getMutlipleQueryBrowserUrl = (perspective: Perspective, params: URLSearchParams) => {
  switch (perspective) {
    case 'virtualization-perspective':
      return `/virt-monitoring/query-browser?${params.toString()}`;
    case 'acm':
      return '';
    case 'admin':
    default:
      return `/monitoring/query-browser?${params.toString()}`;
  }
};

export const getLegacyDashboardsUrl = (perspective: Perspective, boardName: string) => {
  switch (perspective) {
    case 'virtualization-perspective':
      return `/virt-monitoring/dashboards/${boardName}`;
    case 'acm':
      return '';
    case 'admin':
    default:
      return `/monitoring/dashboards/${boardName}`;
  }
};

export const getDashboardUrl = (perspective: Perspective) => {
  switch (perspective) {
    case 'virtualization-perspective':
      return `/virt-monitoring/v2/dashboards/view`;
    case 'admin':
      return `/monitoring/v2/dashboards/view`;
    case 'acm':
      return `/multicloud/monitoring/v2/dashboards/view`;
    default:
      return '';
  }
};

export const getDashboardsListUrl = (perspective: Perspective) => {
  switch (perspective) {
    case 'virtualization-perspective':
      return `/virt-monitoring/v2/dashboards`;
    case 'admin':
      return `/monitoring/v2/dashboards`;
    case 'acm':
      return `/multicloud/monitoring/v2/dashboards`;
    default:
      return '';
  }
};
