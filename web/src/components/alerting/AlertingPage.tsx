import { PageSection, Title } from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { HorizontalNav } from '@openshift-console/dynamic-plugin-sdk';

const AlertsPage = React.lazy(
  () => import(/* webpackChunkName: "AlertsPage" */ '../alerting/AlertsPage'),
);
const SilencesPage = React.lazy(
  () => import(/* webpackChunkName: "SilencesPage" */ '../alerting/SilencesPage'),
);
const AlertRulesPage = React.lazy(
  () => import(/* webpackChunkName: "AlertRulesPage" */ '../alerting/AlertRulesPage'),
);

const AlertingPage: React.FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const pages = [
    {
      href: 'alerts',
      nameKey: 'Alerts',
      component: AlertsPage,
      name: 'Alerts',
    },
    {
      href: 'silences',
      nameKey: 'Silences',
      component: SilencesPage,
      name: 'Silences',
    },
    {
      href: 'alertrules',
      nameKey: 'Alerting rules',
      component: AlertRulesPage,
      name: 'Alerting rules',
    },
  ];

  return (
    <>
      <PageSection hasBodyWrapper={false}>
        <Title headingLevel="h1">{t('Alerting')}</Title>
        <HorizontalNav contextId="admin-console-observe" pages={pages} />
      </PageSection>
    </>
  );
};

export default AlertingPage;
