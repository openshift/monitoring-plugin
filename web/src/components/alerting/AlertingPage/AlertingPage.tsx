import { PageSection, Title } from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  HorizontalNav,
  NamespaceBar,
  useActivePerspective,
} from '@openshift-console/dynamic-plugin-sdk';
import { MonitoringPlugins } from '../../utils';

const AlertsPage = React.lazy(() => import(/* webpackChunkName: "AlertsPage" */ '../AlertsPage'));
const SilencesPage = React.lazy(
  () => import(/* webpackChunkName: "SilencesPage" */ '../SilencesPage'),
);
const AlertRulesPage = React.lazy(
  () => import(/* webpackChunkName: "AlertRulesPage" */ '../AlertRulesPage'),
);

const AlertingPage: React.FC<{ plugin: MonitoringPlugins }> = ({ plugin }) => {
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
      component: () => <AlertsPage plugin={plugin} />,
      name: 'Alerts',
    },
    {
      href: 'silences',
      // t('Silences')
      nameKey: 'Silences',
      component: () => <SilencesPage plugin={plugin} />,
      name: 'Silences',
    },
    {
      href: 'alertrules',
      // t('Alerting Rules') -- for console.tab extension
      // t('Alerting rules')
      nameKey: 'Alerting rules',
      component: () => <AlertRulesPage plugin={plugin} />,
      name: 'Alerting rules',
    },
  ];

  return (
    <>
      <NamespaceBar />
      <PageSection hasBodyWrapper={false}>
        <Title headingLevel="h1">{t('Alerting')}</Title>
        <HorizontalNav contextId={contextId} pages={pages} />
      </PageSection>
    </>
  );
};

export default AlertingPage;
