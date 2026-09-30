import { Alert, Rule } from '@openshift-console/dynamic-plugin-sdk';
import * as _ from 'lodash-es';

import { AlertSource } from '@/shared/types/types';

export const getAdditionalSources = <T extends Alert | Rule>(
  data: Array<T>,
  itemSource: (item: T) => string,
) => {
  if (data) {
    const additionalSources = new Set<string>();
    data.forEach((item) => {
      const source = itemSource(item);
      if (source !== AlertSource.Platform && source !== AlertSource.User) {
        additionalSources.add(source);
      }
    });
    return Array.from(additionalSources).map((item) => ({ value: item, label: _.startCase(item) }));
  }
  return [];
};

export const alertingRuleSource = (rule: Rule): AlertSource | string => {
  if (rule.sourceId === undefined || rule.sourceId === 'prometheus') {
    return rule.labels?.prometheus === 'openshift-monitoring/k8s'
      ? AlertSource.Platform
      : AlertSource.User;
  }

  return rule.sourceId;
};

export const alertSource = (alert: Alert): AlertSource | string => alertingRuleSource(alert.rule);
