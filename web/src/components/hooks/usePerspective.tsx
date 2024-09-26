import { PrometheusAlert, Rule, useActivePerspective } from '@openshift-console/dynamic-plugin-sdk';
import { Perspective, rulesKey, alertKey, silencesKey } from 'src/actions/observe';
import { AlertSource } from '../types';
import * as _ from 'lodash-es';
import { AlertResource, labelsToParams, RuleResource, SilenceResource } from '../utils';

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

/**
 * All alertmanager and thanos-querier URLs MUST be converted to point to the proxies
 * on the monitoring-plugin for the acm perspective
 */

export const getAlertsUrl = (perspective: Perspective, namespace?: string) => {
  switch (perspective) {
    case 'acm':
      return '/multicloud/monitoring/alerts';
    case 'admin':
      return '/monitoring/alerts';
    case 'dev':
    default:
      return `/dev-monitoring/ns/${namespace}/alerts`;
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

export const getFetchSilenceAlertUrl = (
  perspective: Perspective,
  alertManagerBaseURL: string,
  namespace: string,
) => {
  if (perspective === 'dev') {
    return `api/alertmanager-tenancy/silences?namespace=${namespace}`;
  }
  if (alertManagerBaseURL) {
    if (perspective === 'acm') {
      return `/multicloud${alertManagerBaseURL}/api/v2/silences`;
    }
    return `${alertManagerBaseURL}/api/v2/silences`;
  }
  return '';
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
      return `/multicloud${alertManagerBaseURL}/api/v2/silence/${silenceID}`;
    case 'admin':
      return `${alertManagerBaseURL}/api/v2/silence/${silenceID}`;
    case 'dev':
    default:
      return `api/alertmanager-tenancy/api/v2/silence/${silenceID}?namespace=${namespace}`;
  }
};
