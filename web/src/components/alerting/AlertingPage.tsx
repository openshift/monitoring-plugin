import {
  PageSection,
  Tab,
  TabContent,
  TabContentBody,
  Tabs,
  TabTitleText,
  Title,
} from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom-v5-compat';
import {
  getAlertRulesUrl,
  getAlertsUrl,
  getSilencesUrl,
  usePerspective,
} from '../hooks/usePerspective';

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
  const { perspective } = usePerspective();
  const navigate = useNavigate();
  const location = useLocation();

  const alertsPath = getAlertsUrl(perspective);
  const silencesPath = getSilencesUrl(perspective);
  const rulesPath = getAlertRulesUrl(perspective);
  const paths = [alertsPath, silencesPath, rulesPath];

  const activeTabKey = React.useMemo(() => {
    const path = location.pathname;
    if (path === alertsPath) {
      return 0;
    }
    if (path === silencesPath) {
      return 1;
    }
    if (path === rulesPath) {
      return 2;
    }
    return -1;
  }, [location.pathname, alertsPath, silencesPath, rulesPath]);

  const handleTabClick = (
    event: React.MouseEvent<any> | React.KeyboardEvent | MouseEvent,
    tabIndex: number | string,
  ) => {
    // prevent the href from redirecting as it causes a full page reload
    event.preventDefault();
    const tabNumber = Number(tabIndex);
    if (tabNumber > -1 && tabNumber < paths.length) {
      navigate(paths[tabNumber]);
      return;
    }
  };

  return (
    <>
      <PageSection hasBodyWrapper={false}>
        <Title headingLevel="h1">{t('Alerting')}</Title>
        <Tabs activeKey={activeTabKey} onSelect={handleTabClick}>
          {/* Add href to tab so that when hovering you see the link in the bottom left */}
          <Tab eventKey={0} title={<TabTitleText>{t('Alerts')}</TabTitleText>} />
          <Tab eventKey={1} title={<TabTitleText>{t('Silences')}</TabTitleText>} />
          <Tab eventKey={2} title={<TabTitleText>{t('Alerting rules')}</TabTitleText>} />
        </Tabs>
      </PageSection>

      <TabContent
        key={0}
        eventKey={0}
        id="alerts-tab-content"
        activeKey={activeTabKey}
        hidden={0 !== activeTabKey}
      >
        <TabContentBody>
          <AlertsPage />
        </TabContentBody>
      </TabContent>

      <TabContent
        key={1}
        eventKey={1}
        id="silences-content"
        activeKey={activeTabKey}
        hidden={1 !== activeTabKey}
      >
        <TabContentBody>
          <SilencesPage />
        </TabContentBody>
      </TabContent>

      <TabContent
        key={2}
        eventKey={2}
        id="alerting-rules-content"
        activeKey={activeTabKey}
        hidden={2 !== activeTabKey}
      >
        <TabContentBody>
          <AlertRulesPage />
        </TabContentBody>
      </TabContent>
    </>
  );
};

export default AlertingPage;
