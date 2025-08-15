import { PageSection, Title } from '@patternfly/react-core';
import type { FC } from 'react';
import { lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { HorizontalNav, useActivePerspective } from '@openshift-console/dynamic-plugin-sdk';

const AlertsPage = lazy(
  () => import(/* webpackChunkName: "AlertsPage" */ '../alerting/AlertsPage'),
);
const SilencesPage = lazy(
  () => import(/* webpackChunkName: "SilencesPage" */ '../alerting/SilencesPage'),
);
const AlertRulesPage = lazy(
  () => import(/* webpackChunkName: "AlertRulesPage" */ '../alerting/AlertRulesPage'),
);

const AlertingPage: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const [perspective] = useActivePerspective();

  // contextId allow console.tab extensions to be injected
  // https://github.com/openshift/console/blob/main/frontend/packages/console-dynamic-plugin-sdk/docs/console-extensions.md#consoletab
  const contextId = `${perspective}-alerts-nav`;

  const pages = [
    {
      href: 'alerts',
      // t('Alerts')
      nameKey: 'Alerts',
      component: AlertsPage,
      name: 'Alerts',
    },
    {
      href: 'silences',
      // t('Silences')
      nameKey: 'Silences',
      component: SilencesPage,
      name: 'Silences',
    },
    {
      href: 'alertrules',
      // t('Alerting Rules') -- for console.tab extension
      // t('Alerting rules')
      nameKey: 'Alerting rules',
      component: AlertRulesPage,
      name: 'Alerting rules',
    },
  ];

  return (
    <>
      <PageSection hasBodyWrapper={false}>
        <Title headingLevel="h1">{t('Alerting')}</Title>
        <HorizontalNav contextId={contextId} pages={pages} />
      </PageSection>
    </>
  );
};

export default AlertingPage;
