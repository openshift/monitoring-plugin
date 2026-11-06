import { useMemo } from 'react';
import { useSelector } from 'react-redux';

import { AlertDomain } from '@/features/troubleshooting/korrel8r/alert';
import { K8sDomain } from '@/features/troubleshooting/korrel8r/k8s';
import { LogDomain } from '@/features/troubleshooting/korrel8r/log';
import { MetricDomain } from '@/features/troubleshooting/korrel8r/metric';
import { NetflowDomain } from '@/features/troubleshooting/korrel8r/netflow';
import { TraceDomain } from '@/features/troubleshooting/korrel8r/trace';
import { Domains } from '@/features/troubleshooting/korrel8r/types';
import { State } from '@/features/troubleshooting/store/reducers';

// The alert domain is dependent on alert Rules state , so we need a hook for domains
export const useDomains = () => {
  const alertRules = useSelector(
    (state: State) => state?.plugins?.mp?.alerting?.cmo?.['#ALL_NS#']?.rules,
  );

  const alertIDs = useMemo(() => {
    if (!alertRules) return new Map<string, string>();
    return new Map<string, string>(alertRules.map(({ id, name }) => [id, name]));
  }, [alertRules]);

  const domains = useMemo(
    () =>
      new Domains(
        new AlertDomain(alertIDs),
        new K8sDomain(),
        new LogDomain(),
        new MetricDomain(),
        new NetflowDomain(),
        new TraceDomain(),
      ),
    [alertIDs],
  );
  return domains;
};
