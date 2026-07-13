import { Alert, K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';
import { k8sListResourceItems } from '@openshift-console/dynamic-plugin-sdk/lib/utils/k8s';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { ProposalModel } from '../console/models';
import { getAlertFingerprintPrefix } from './alert-identifier';
import {
  PROPOSAL_LABEL_FINGERPRINT,
  PROPOSAL_LABEL_SOURCE,
  PROPOSAL_NAMESPACE,
  PROPOSAL_SOURCE_ALERTMANAGER,
  PROPOSAL_STALE_TIME,
} from './constants';

const buildQueryFn = (namespace: string, alertFingerprint: string) => () =>
  k8sListResourceItems<K8sResourceCommon>({
    model: ProposalModel,
    queryParams: {
      ns: namespace,
      labelSelector: {
        matchLabels: {
          [PROPOSAL_LABEL_FINGERPRINT]: alertFingerprint,
          [PROPOSAL_LABEL_SOURCE]: PROPOSAL_SOURCE_ALERTMANAGER,
        },
      },
    },
  });

export const useProposalCheck = (alert: Alert) => {
  const alertFingerprint = useMemo(() => getAlertFingerprintPrefix(alert.labels), [alert.labels]);
  const alertNamespace = alert.labels?.namespace;
  const hasDistinctAlertNamespace = !!alertNamespace && alertNamespace !== PROPOSAL_NAMESPACE;
  const [shouldFetch, setShouldFetch] = useState(false);

  const {
    data: defaultNsData,
    isFetching: defaultNsFetching,
    isError: defaultNsError,
  } = useQuery({
    queryKey: ['proposal-check', PROPOSAL_NAMESPACE, alertFingerprint],
    queryFn: buildQueryFn(PROPOSAL_NAMESPACE, alertFingerprint),
    enabled: shouldFetch,
    staleTime: PROPOSAL_STALE_TIME,
    retry: false,
  });

  const {
    data: alertNsData,
    isFetching: alertNsFetching,
    isError: alertNsError,
  } = useQuery({
    queryKey: ['proposal-check', alertNamespace, alertFingerprint],
    queryFn: buildQueryFn(alertNamespace!, alertFingerprint),
    enabled: shouldFetch && hasDistinctAlertNamespace,
    staleTime: PROPOSAL_STALE_TIME,
    retry: false,
  });

  const prefetch = useCallback(() => setShouldFetch(true), []);

  const proposals = useMemo(() => {
    const matchesFp = (p: K8sResourceCommon) =>
      p.metadata?.labels?.[PROPOSAL_LABEL_FINGERPRINT] === alertFingerprint;

    return [...(defaultNsData ?? []).filter(matchesFp), ...(alertNsData ?? []).filter(matchesFp)];
  }, [defaultNsData, alertNsData, alertFingerprint]);

  const isFetching = defaultNsFetching || alertNsFetching;
  const isError = defaultNsError && (hasDistinctAlertNamespace ? alertNsError : true);

  return {
    proposals,
    hasProposal: proposals.length > 0,
    isFetching,
    isError,
    prefetch,
    alertFingerprint,
  };
};
