import { Alert, K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';
import { k8sListResourceItems } from '@openshift-console/dynamic-plugin-sdk/lib/utils/k8s';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { ProposalModel } from '../console/models';
import { getAlertFingerprintPrefix, matchesProposal } from './alert-identifier';
import {
  PROPOSAL_LABEL_FINGERPRINT,
  PROPOSAL_LABEL_SOURCE,
  PROPOSAL_NAMESPACE,
  PROPOSAL_SOURCE_ALERTMANAGER,
  PROPOSAL_STALE_TIME,
} from './constants';

const buildQueryFn = (alertFingerprint: string) => () =>
  k8sListResourceItems<K8sResourceCommon>({
    model: ProposalModel,
    queryParams: {
      ns: PROPOSAL_NAMESPACE,
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
  const [shouldFetch, setShouldFetch] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ['proposal-check', alertFingerprint],
    queryFn: buildQueryFn(alertFingerprint),
    enabled: shouldFetch,
    staleTime: PROPOSAL_STALE_TIME,
    retry: false,
  });

  const prefetch = useCallback(() => setShouldFetch(true), []);

  const proposals = useMemo(
    () => (data ?? []).filter((p) => matchesProposal(alert, p)),
    [data, alert],
  );

  return {
    proposals,
    hasProposal: proposals.length > 0,
    isFetching,
    prefetch,
    alertFingerprint,
  };
};
