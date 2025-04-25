import { PageSection, Tab, Tabs, TabTitleText, Title } from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom-v5-compat';
import {
  getAlertRulesUrl,
  getAlertsUrl,
  getSilencesUrl,
  usePerspective,
} from '../hooks/usePerspective';

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

      <Outlet />
    </>
  );
};

export default AlertingPage;
