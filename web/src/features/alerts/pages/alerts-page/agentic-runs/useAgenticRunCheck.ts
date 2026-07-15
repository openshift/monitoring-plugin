import { Alert, K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';
import { k8sListResourceItems } from '@openshift-console/dynamic-plugin-sdk/lib/utils/k8s';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { AgenticRunModel } from '@shared/console/models';

import { getAlertFingerprintPrefix } from './alert-identifier';
import {
  AGENTIC_RUN_LABEL_FINGERPRINT,
  AGENTIC_RUN_LABEL_SOURCE,
  AGENTIC_RUN_NAMESPACE,
  AGENTIC_RUN_SOURCE_ALERTMANAGER,
  AGENTIC_RUN_STALE_TIME,
} from './constants';

const buildQueryFn = (namespace: string, alertFingerprint: string) => () =>
  k8sListResourceItems<K8sResourceCommon>({
    model: AgenticRunModel,
    queryParams: {
      ns: namespace,
      labelSelector: {
        matchLabels: {
          [AGENTIC_RUN_LABEL_FINGERPRINT]: alertFingerprint,
          [AGENTIC_RUN_LABEL_SOURCE]: AGENTIC_RUN_SOURCE_ALERTMANAGER,
        },
      },
    },
  });

export const useAgenticRunCheck = (alert: Alert) => {
  const alertFingerprint = useMemo(() => getAlertFingerprintPrefix(alert.labels), [alert.labels]);
  const alertNamespace = alert.labels?.namespace;
  const hasDistinctAlertNamespace = !!alertNamespace && alertNamespace !== AGENTIC_RUN_NAMESPACE;
  const [shouldFetch, setShouldFetch] = useState(false);

  const {
    data: defaultNsData,
    isFetching: defaultNsFetching,
    isError: defaultNsError,
  } = useQuery({
    queryKey: ['agentic-run-check', AGENTIC_RUN_NAMESPACE, alertFingerprint],
    queryFn: buildQueryFn(AGENTIC_RUN_NAMESPACE, alertFingerprint),
    enabled: shouldFetch,
    staleTime: AGENTIC_RUN_STALE_TIME,
    retry: false,
  });

  const {
    data: alertNsData,
    isFetching: alertNsFetching,
    isError: alertNsError,
  } = useQuery({
    queryKey: ['agentic-run-check', alertNamespace, alertFingerprint],
    queryFn: buildQueryFn(alertNamespace!, alertFingerprint),
    enabled: shouldFetch && hasDistinctAlertNamespace,
    staleTime: AGENTIC_RUN_STALE_TIME,
    retry: false,
  });

  const prefetch = useCallback(() => setShouldFetch(true), []);

  const agenticRuns = useMemo(() => {
    const matchesFp = (p: K8sResourceCommon) =>
      p.metadata?.labels?.[AGENTIC_RUN_LABEL_FINGERPRINT] === alertFingerprint;

    return [...(defaultNsData ?? []).filter(matchesFp), ...(alertNsData ?? []).filter(matchesFp)];
  }, [defaultNsData, alertNsData, alertFingerprint]);

  const isFetching = defaultNsFetching || alertNsFetching;
  const isError = defaultNsError && (hasDistinctAlertNamespace ? alertNsError : true);

  return {
    agenticRuns,
    hasAgenticRun: agenticRuns.length > 0,
    isFetching,
    isError,
    prefetch,
    alertFingerprint,
  };
};
