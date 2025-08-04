import { PrometheusAlert, Rule, useActivePerspective } from '@openshift-console/dynamic-plugin-sdk';
import { Perspective, rulesKey, alertKey, silencesKey } from '../../actions/observe';
import { AlertSource } from '../types';
import * as _ from 'lodash-es';
import { AlertResource, labelsToParams, RuleResource, SilenceResource } from '../utils';
import {
  ALERTMANAGER_BASE_PATH,
  ALERTMANAGER_PROXY_PATH,
  ALERTMANAGER_TENANCY_BASE_PATH,
} from '../console/graphs/helpers';
import { MonitoringState } from '../../reducers/observe';

export type UrlRoot = 'monitoring' | 'dev-monitoring' | 'multicloud/monitoring' | 'virt-monitoring';

const enum UrlRecord {
  admin = 'monitoring',
  dev = 'dev-monitoring',
  'virtualization-perspective' = 'virt-monitoring',
  acm = 'multicloud/monitoring',
}

type usePerspectiveReturn = {
  perspective: Perspective;
  rulesKey: rulesKey;
  alertsKey: alertKey;
  silencesKey: silencesKey;
  alertingContextId:
    | 'dev-observe-alerting'
    | 'observe-alerting'
    | 'acm-observe-alerting'
    | 'virt-observe-alerting';
  urlRoot: UrlRoot;
  defaultAlertTenant: Array<AlertSource>;
};

export const usePerspective = (): usePerspectiveReturn => {
  const [perspective] = useActivePerspective();

  switch (perspective) {
    case 'dev':
      return {
        perspective: 'dev',
        rulesKey: 'devRules',
        alertsKey: 'devAlerts',
        silencesKey: 'devSilences',
        alertingContextId: 'dev-observe-alerting',
        urlRoot: UrlRecord.dev,
        defaultAlertTenant: [AlertSource.User],
      };
    case 'admin':
      return {
        perspective: 'admin',
        rulesKey: 'rules',
        alertsKey: 'alerts',
        silencesKey: 'silences',
        alertingContextId: 'observe-alerting',
        urlRoot: UrlRecord.admin,
        defaultAlertTenant: [AlertSource.Platform],
      };
    case 'virtualization-perspective':
      return {
        perspective: 'virtualization-perspective',
        rulesKey: 'virtRules',
        alertsKey: 'virtAlerts',
        silencesKey: 'virtSilences',
        alertingContextId: 'virt-observe-alerting',
        urlRoot: UrlRecord['virtualization-perspective'],
        defaultAlertTenant: [AlertSource.Platform],
      };
    default:
      return {
        perspective: 'acm',
        rulesKey: 'acmRules',
        alertsKey: 'acmAlerts',
        silencesKey: 'acmSilences',
        alertingContextId: 'acm-observe-alerting',
        urlRoot: UrlRecord.acm,
        defaultAlertTenant: [],
      };
  }
};

export const getAlertsKey = (perspective: Perspective): alertKey => {
  switch (perspective) {
    case 'acm':
      return 'acmAlerts';
    case 'admin':
      return 'alerts';
    case 'virtualization-perspective':
      return 'virtAlerts';
    case 'dev':
    default:
      return 'devAlerts';
  }
};

export const getSilencesKey = (perspective: Perspective): silencesKey => {
  switch (perspective) {
    case 'acm':
      return 'acmSilences';
    case 'admin':
      return 'silences';
    case 'virtualization-perspective':
      return 'virtSilences';
    case 'dev':
    default:
      return 'devSilences';
  }
};

export const getAlertsUrl = (perspective: Perspective, namespace?: string) => {
  switch (perspective) {
    case 'acm':
      return `/multicloud${AlertResource.plural}`;
    case 'admin':
      return AlertResource.plural;
    case 'virtualization-perspective':
      return `/virt-monitoring/alerts`;
    case 'dev':
    default:
      return `/dev-monitoring/ns/${namespace}/alerts`;
  }
};

// There is no equivalent rules list page in the developer perspective
export const getAlertRulesUrl = (perspective: Perspective, namespace?: string) => {
  switch (perspective) {
    case 'acm':
      return `/multicloud${RuleResource.plural}`;
    case 'virtualization-perspective':
      return `/virt-monitoring/alertrules`;
    case 'dev':
      return `/dev-monitoring/ns/${namespace}/alertrules`;
    case 'admin':
    default:
      return RuleResource.plural;
  }
};

export const getSilencesUrl = (perspective: Perspective, namespace?: string) => {
  switch (perspective) {
    case 'acm':
      return `/multicloud${SilenceResource.plural}`;
    case 'admin':
      return SilenceResource.plural;
    case 'virtualization-perspective':
      return `/virt-monitoring/silences`;
    case 'dev':
    default:
      return `/dev-monitoring/ns/${namespace}/silences`;
  }
};

export const getNewSilenceAlertUrl = (
  perspective: Perspective,
  alert: PrometheusAlert,
  namespace?: string,
) => {
  switch (perspective) {
    case 'acm':
      return `/multicloud${SilenceResource.plural}/~new?${labelsToParams(alert.labels)}`;
    case 'admin':
      return `${SilenceResource.plural}/~new?${labelsToParams(alert.labels)}`;
    case 'virtualization-perspective':
      return `/virt-monitoring/silences/~new?${labelsToParams(alert.labels)}`;
    case 'dev':
    default:
      return `/dev-monitoring/ns/${namespace}/silences/~new?${labelsToParams(alert.labels)}`;
  }
};

export const getNewSilenceUrl = (perspective: Perspective, namespace?: string) => {
  switch (perspective) {
    case 'acm':
      return `/multicloud${SilenceResource.plural}/~new`;
    case 'virtualization-perspective':
      return `/virt-monitoring/silences/~new`;
    case 'admin':
      return `${SilenceResource.plural}/~new`;
    case 'dev':
    default:
      return `/dev-monitoring/ns/${namespace}/silences/~new`;
  }
};

export const getRuleUrl = (perspective: Perspective, rule: Rule, namespace?: string) => {
  switch (perspective) {
    case 'acm':
      return `/multicloud${RuleResource.plural}/${_.get(rule, 'id')}`;
    case 'virtualization-perspective':
      return `/virt-monitoring/alertrules/${rule?.id}`;
    case 'admin':
      return `${RuleResource.plural}/${_.get(rule, 'id')}`;
    case 'dev':
    default:
      return `/dev-monitoring/ns/${namespace}/rules/${rule?.id}`;
  }
};

export const getSilenceAlertUrl = (perspective: Perspective, id: string, namespace?: string) => {
  switch (perspective) {
    case 'acm':
      return `/multicloud${SilenceResource.plural}/${id}`;
    case 'virtualization-perspective':
      return `/virt-monitoring/silences/${id}`;
    case 'admin':
      return `${SilenceResource.plural}/${id}`;
    case 'dev':
    default:
      return `/dev-monitoring/ns/${namespace}/silences/${id}`;
  }
};

export const getEditSilenceAlertUrl = (
  perspective: Perspective,
  id: string,
  namespace?: string,
) => {
  switch (perspective) {
    case 'acm':
      return `/multicloud${SilenceResource.plural}/${id}/edit`;
    case 'admin':
      return `${SilenceResource.plural}/${id}/edit`;
    case 'virtualization-perspective':
      return `/virt-monitoring/silences/${id}/edit`;
    case 'dev':
    default:
      return `/dev-monitoring/ns/${namespace}/silences/${id}/edit`;
  }
};

export const getFetchSilenceAlertUrl = (perspective: Perspective, namespace?: string) => {
  switch (perspective) {
    case 'acm':
      return `${ALERTMANAGER_PROXY_PATH}/api/v2/silences`;
    case 'admin':
      return `${ALERTMANAGER_BASE_PATH}/api/v2/silences`;
    case 'virtualization-perspective':
      return `${ALERTMANAGER_BASE_PATH}/api/v2/silences`;
    case 'dev':
    default:
      return `${ALERTMANAGER_TENANCY_BASE_PATH}/api/v2/silences?namespace=${namespace}`;
  }
};

export const getAlertUrl = (
  perspective: Perspective,
  alert: PrometheusAlert,
  ruleID: string,
  namespace?: string,
) => {
  switch (perspective) {
    case 'acm':
      return `/multicloud${AlertResource.plural}/${ruleID}?${labelsToParams(alert.labels)}`;
    case 'virtualization-perspective':
      return `/virt-monitoring/alerts/${ruleID}?${labelsToParams(alert.labels)}`;
    case 'admin':
      return `${AlertResource.plural}/${ruleID}?${labelsToParams(alert.labels)}`;
    case 'dev':
    default:
      return `/dev-monitoring/ns/${namespace}/alerts/${ruleID}?${labelsToParams(alert.labels)}`;
  }
};

export const getFetchSilenceUrl = (
  perspective: Perspective,
  silenceID: string,
  namespace?: string,
) => {
  switch (perspective) {
    case 'acm':
      return `${ALERTMANAGER_PROXY_PATH}/api/v2/silence/${silenceID}`;
    case 'admin':
      return `${ALERTMANAGER_BASE_PATH}/api/v2/silence/${silenceID}`;
    case 'virtualization-perspective':
      return `${ALERTMANAGER_BASE_PATH}/api/v2/silence/${silenceID}`;
    case 'dev':
    default:
      return `${ALERTMANAGER_TENANCY_BASE_PATH}/api/v2/silence/${silenceID}?namespace=${namespace}`;
  }
};

// Redux state defined in the openshift/console repo
export const getLegacyObserveState = (perspective: Perspective, state: MonitoringState) => {
  switch (perspective) {
    case 'acm':
      return state.plugins?.mcp;
    case 'virtualization-perspective':
      return state.plugins?.mp;
    case 'admin':
    case 'dev':
    default:
      return state.observe;
  }
};

// Redux state defined in the openshift/monitoring-plugin repo
export const getObserveState = (perspective: Perspective, state: MonitoringState) => {
  switch (perspective) {
    case 'acm':
      return state.plugins?.mcp;
    case 'virtualization-perspective':
    case 'admin':
    case 'dev':
    default:
      return state.plugins?.mp;
  }
};

export const getQueryBrowserUrl = (perspective: Perspective, query: string, namespace?: string) => {
  switch (perspective) {
    case 'admin':
      return `/monitoring/query-browser?query0=${encodeURIComponent(query)}`;
    case 'dev':
      return `/dev-monitoring/ns/${namespace}/metrics?query0=${encodeURIComponent(query)}`;
    case 'virtualization-perspective':
      return `/virt-monitoring/query-browser?query0=${encodeURIComponent(query)}`;
    case 'acm':
    default:
      return '';
  }
};

export const getMutlipleQueryBrowserUrl = (
  perspective: Perspective,
  params: URLSearchParams,
  namespace?: string,
) => {
  switch (perspective) {
    case 'admin':
      return `/monitoring/query-browser?${params.toString()}`;
    case 'dev':
      return `/dev-monitoring/ns/${namespace}/metrics?${params.toString()}`;
    case 'virtualization-perspective':
      return `/virt-monitoring/query-browser?${params.toString()}`;
    case 'acm':
    default:
      return '';
  }
};

export const getLegacyDashboardsUrl = (
  perspective: Perspective,
  boardName: string,
  namespace?: string,
) => {
  switch (perspective) {
    case 'virtualization-perspective':
      return `/virt-monitoring/dashboards/${boardName}`;
    case 'admin':
      return `/monitoring/dashboards/${boardName}`;
    case 'dev':
      return `/dev-monitoring/ns/${namespace}?dashboard=${boardName}`;
    case 'acm':
    default:
      return '';
  }
};

export const getDashboardsUrl = (perspective: Perspective) => {
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
