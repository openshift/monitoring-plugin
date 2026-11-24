import { SilenceStates, useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import { Alert, Button } from '@patternfly/react-core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

import { useSilencesQuery } from '@/features/alert-management-api/hooks/useSilencesQuery';
import { getSilencesPageUrl, silencesPath } from '@/features/alert-management-api/utils/urls';
import { SilenceEditInfo } from '@/shared/components/silences/SilenceEditInfo';
import { SilenceFormContent } from '@/shared/components/silences/SilenceForm';
import { ConsoleEmptyState } from '@/shared/console/console-shared/src/components/empty-state/ConsoleEmptyState';
import { LoadingBox } from '@/shared/console/console-shared/src/components/loading/LoadingBox';
import { StatusBox } from '@/shared/console/console-shared/src/components/status/StatusBox';
import { QueryParams } from '@/shared/constants/query-params';
import { useMonitoring } from '@/shared/hooks/useMonitoring';
import { silenceState } from '@/shared/utils/alerts/formatting';
import { getSilenceFormDefaults } from '@/shared/utils/alerts/get-silence-form-defaults';
import { SilenceResource } from '@/shared/utils/utils';

// Wait for syncing the namespace
const useSilenceNamespace = (targetNamespace?: string) => {
  const [namespace, setNamespace] = useActiveNamespace();
  useEffect(() => {
    if (targetNamespace && targetNamespace !== namespace) {
      setNamespace(targetNamespace);
    }
  }, [targetNamespace, namespace, setNamespace]);
  return !targetNamespace || targetNamespace === namespace;
};

const useSilenceFormActions = () => {
  const client = useQueryClient();
  const { prometheus } = useMonitoring();

  const navigate = useNavigate();
  const { state } = useLocation();

  return {
    onSuccess: (silenceID: string) => {
      client.invalidateQueries(['alert-management-api', prometheus, 'silences']);
      const url = getSilencesPageUrl(silenceID);
      // until silence detail view is implemented just log
      // eslint-disable-next-line no-console
      console.debug('silence detail url', url);
      navigate(url);
    },
    onCancel: () => {
      if (state?.silenceCanGoBack === true) {
        navigate(-1);
      } else {
        navigate(silencesPath, { replace: true });
      }
    },
  };
};

export function SilenceManagementCreatePage() {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const { accessCheckLoading, useAlertsTenancy } = useMonitoring();

  const actions = useSilenceFormActions();

  const [params] = useSearchParams();
  const namespaceReady = useSilenceNamespace(params.get(QueryParams.Namespace) || undefined);

  const matchers = Array.from(params, ([name, value]) => ({
    name,
    value,
    isRegex: false,
    isEqual: true,
  }));

  if (accessCheckLoading || !namespaceReady) {
    return <LoadingBox />;
  }

  return (
    <SilenceFormContent
      key={params.toString()}
      defaults={matchers.length ? { matchers } : {}}
      title={matchers.length ? t('Silence alert') : t('Create silence')}
      isNamespaced={useAlertsTenancy}
      {...actions}
    />
  );
}

export function SilenceManagementEditPage({ id }: { id: string }) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const { accessCheckLoading, useAlertsTenancy } = useMonitoring();

  const query = useSilencesQuery();
  const actions = useSilenceFormActions();

  const silence = query.data?.find((item) => item.id === id);
  const namespaceMatchers = silence?.matchers.filter(({ name }) => name === 'namespace') ?? [];
  const [potentialNamespaceMatcher] = namespaceMatchers;

  const exactNamespace =
    namespaceMatchers.length === 1 &&
    !potentialNamespaceMatcher.isRegex &&
    potentialNamespaceMatcher.isEqual !== false
      ? potentialNamespaceMatcher.value
      : undefined;

  const namespaceReady = useSilenceNamespace(
    !query.isLoading && useAlertsTenancy ? exactNamespace : undefined,
  );

  const loaded = !query.isLoading && (!silence || (!accessCheckLoading && namespaceReady));
  const isExpired = !!silence && silenceState(silence) === SilenceStates.Expired;

  return (
    <StatusBox
      data={silence}
      label={SilenceResource.label}
      loaded={loaded}
      skeleton={<LoadingBox />}
      loadError={silence ? undefined : query.error}
      EmptyMsg={() => (
        <ConsoleEmptyState
          title={t('Silence not found')}
          primaryActions={[
            <Button key="back" onClick={actions.onCancel}>
              {t('Back')}
            </Button>,
          ]}
        />
      )}
    >
      {silence &&
        (useAlertsTenancy && !exactNamespace ? (
          <Alert isInline variant="warning" title={t('Cannot edit silence in a single namespace')}>
            {t('This silence requires permissions to manage silences across all namespaces.')}
          </Alert>
        ) : (
          <SilenceFormContent
            key={silence.id}
            defaults={getSilenceFormDefaults(silence)}
            Info={isExpired ? undefined : SilenceEditInfo}
            title={isExpired ? t('Recreate silence') : t('Edit silence')}
            isNamespaced={useAlertsTenancy}
            {...actions}
          />
        ))}
    </StatusBox>
  );
}
