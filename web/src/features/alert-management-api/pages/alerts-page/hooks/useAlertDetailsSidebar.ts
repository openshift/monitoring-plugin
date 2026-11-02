import { useToast } from '@openshift-console/dynamic-plugin-sdk';
import { AlertVariant } from '@patternfly/react-core';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import {
  alertIDParam,
  alertRuleIDParam,
} from '@/features/alert-management-api/pages/alerts-page/utils/alert-details';
import type { ManagedAlert } from '@/features/alert-management-api/types/types';
import { computeAlertFingerprint } from '@/shared/utils/alerts/alert-fingerprint';

export function useAlertDetailsSidebar(alerts: ManagedAlert[] | undefined) {
  const [params, setParams] = useSearchParams();
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { addToast } = useToast();
  const ruleID = params.get(alertRuleIDParam);
  const alertID = params.get(alertIDParam);
  const hasSelection = params.has(alertRuleIDParam) || params.has(alertIDParam);
  const matches = useMemo(() => {
    if (!ruleID || !alertID) {
      return undefined;
    }
    return alerts?.filter(
      (alert) => alert.rule.id === ruleID && computeAlertFingerprint(alert.labels) === alertID,
    );
  }, [ruleID, alertID, alerts]);
  const selectedAlert = matches?.length >= 1 ? matches[0] : undefined;
  // Alert list has already been fetched but there isn't a singular match
  const missingAlertInList = !!alerts && !selectedAlert;
  const isInvalid = hasSelection && (!ruleID || !alertID || missingAlertInList);

  useEffect(() => {
    if (isInvalid) {
      addToast({
        title: t('Alert Not Found'),
        variant: AlertVariant.warning,
        content: t('No alert found with specified rule ID and label set'),
        dismissible: true,
      });
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.delete(alertRuleIDParam);
          next.delete(alertIDParam);
          return next;
        },
        { replace: true },
      );
    }
  }, [isInvalid, setParams, addToast, t]);

  const closeAlertDetails = () => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete(alertRuleIDParam);
      next.delete(alertIDParam);
      return next;
    });
  };

  return { selectedAlert, closeAlertDetails };
}
