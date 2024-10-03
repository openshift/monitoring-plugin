import { PrometheusAlert, Rule, useActivePerspective } from '@openshift-console/dynamic-plugin-sdk';
import { Perspective, rulesKey, alertKey, silencesKey } from 'src/actions/observe';
import { AlertSource } from '../types';
import * as _ from 'lodash-es';
import { AlertResource, labelsToParams, RuleResource, SilenceResource } from '../utils';
import {
  ALERTMANAGER_BASE_PATH,
  ALERTMANAGER_PROXY_PATH,
  ALERTMANAGER_TENANCY_BASE_PATH,
} from '../console/graphs/helpers';
import { MonitoringState } from '../../reducers/observe';

type usePerspectiveReturn = {
  perspective: Perspective;
  rulesKey: rulesKey;
  alertsKey: alertKey;
  silencesKey: silencesKey;
  alertingContextId: 'dev-observe-alerting' | 'observe-alerting' | 'acm-observe-alerting';
  defaultAlertTenant: AlertSource;
};

export const usePerspective = (): usePerspectiveReturn => {
  const [perspective] = useActivePerspective();

  if (perspective === 'dev') {
    return {
      perspective: 'dev',
      rulesKey: 'devRules',
      alertsKey: 'devAlerts',
      silencesKey: 'devSilences',
      alertingContextId: 'dev-observe-alerting',
      defaultAlertTenant: AlertSource.User,
    };
  } else if (perspective === 'admin') {
    return {
      perspective: 'admin',
      rulesKey: 'rules',
      alertsKey: 'alerts',
      silencesKey: 'silences',
      alertingContextId: 'observe-alerting',
      defaultAlertTenant: AlertSource.Platform,
    };
  }
  // perspective === acm
  return {
    perspective: 'acm',
    rulesKey: 'acmRules',
    alertsKey: 'acmAlerts',
    silencesKey: 'acmSilences',
    alertingContextId: 'acm-observe-alerting',
    defaultAlertTenant: AlertSource.Platform, //wrong
  };
};

export const getAlertsKey = (perspective: Perspective): alertKey => {
  switch (perspective) {
    case 'acm':
      return 'acmAlerts';
    case 'admin':
      return 'alerts';
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
    case 'dev':
    default:
      return 'devSilences';
  }
};

/**
 * All alertmanager and thanos-querier URLs MUST be converted to point to the proxies
 * on the monitoring-plugin for the acm perspective
 */

export const getAlertsUrl = (perspective: Perspective, namespace?: string) => {
  switch (perspective) {
    case 'acm':
      return `/multicloud${AlertResource.plural}`;
    case 'admin':
      return AlertResource.plural;
    case 'dev':
    default:
      return `/dev-monitoring/ns/${namespace}/alerts`;
  }
};

// There is no equivalent rules list page in the developer perspective
export const getAlertRulesUrl = (perspective: Perspective) => {
  switch (perspective) {
    case 'acm':
      return `/multicloud${RuleResource.plural}`;
    default:
    case 'admin':
      return RuleResource.plural;
  }
};

export const getSilencesUrl = (perspective: Perspective, namespace?: string) => {
  switch (perspective) {
    case 'acm':
      return `/multicloud${SilenceResource.plural}`;
    case 'admin':
      return SilenceResource.plural;
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
    case 'dev':
    default:
      return `/dev-monitoring/ns/${namespace}/silences/~new?${labelsToParams(alert.labels)}`;
  }
};

export const getRuleUrl = (perspective: Perspective, rule: Rule, namespace?: string) => {
  switch (perspective) {
    case 'acm':
      return `/multicloud${RuleResource.plural}/${_.get(rule, 'id')}`;
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
    case 'dev':
    default:
      return `/dev-monitoring/ns/${namespace}/silences/${id}/edit`;
  }
};

export const getFetchSilenceAlertUrl = (perspective: Perspective, namespace: string) => {
  switch (perspective) {
    case 'acm':
      return `${ALERTMANAGER_PROXY_PATH}/api/v2/silences`;
    case 'admin':
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
    case 'admin':
      return `${AlertResource.plural}/${ruleID}?${labelsToParams(alert.labels)}`;
    case 'dev':
    default:
      return `/dev-monitoring/ns/${namespace}/alerts/${ruleID}?${labelsToParams(alert.labels)}`;
  }
};

export const getSilenceUrl = (
  perspective: Perspective,
  silenceID: string,
  alertManagerBaseURL: string,
  namespace?: string,
) => {
  switch (perspective) {
    case 'acm':
      return `${ALERTMANAGER_PROXY_PATH}/api/v2/silence/${silenceID}`;
    case 'admin':
      return `${ALERTMANAGER_BASE_PATH}/api/v2/silence/${silenceID}`;
    case 'dev':
    default:
      return `${ALERTMANAGER_TENANCY_BASE_PATH}/api/v2/silence/${silenceID}?namespace=${namespace}`;
  }
};

export const getObserveState = (perspective: Perspective, state: MonitoringState) => {
  switch (perspective) {
    case 'acm':
      return state.plugins?.monitoring;
    case 'admin':
    case 'dev':
    default:
      return state.observe;
  }
};
