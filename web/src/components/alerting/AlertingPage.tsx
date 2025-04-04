import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Route, RouteComponentProps, Switch, useHistory } from 'react-router-dom';

import {
  getAlertRulesUrl,
  getAlertsUrl,
  getSilencesUrl,
  usePerspective,
} from '../hooks/usePerspective';
import AlertsPage from '../alerting/AlertsPage';
import SilencesPage from '../alerting/SilencesPage';
import AlertRulesPage from '../alerting/AlertRulesPage';
import { Divider, PageSection, Tab, Tabs, TabTitleText, Title } from '@patternfly/react-core';

const AlertingPage: React.FC<RouteComponentProps<{ url: string }>> = ({ match }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const history = useHistory();

  const alertsPath = getAlertsUrl(perspective);
  const silencesPath = getSilencesUrl(perspective);
  const rulesPath = getAlertRulesUrl(perspective);
  const paths = [alertsPath, silencesPath, rulesPath];

  const { url } = match;
  let activeTabKey = -1;
  switch (url) {
    case alertsPath:
      activeTabKey = 0;
      break;
    case silencesPath:
      activeTabKey = 1;
      break;
    case rulesPath:
      activeTabKey = 2;
  }

  const handleTabClick = (
    event: React.MouseEvent<any> | React.KeyboardEvent | MouseEvent,
    tabIndex: number | string,
  ) => {
    // prevent the href from redirecting as it causes a full page reload
    event.preventDefault();
    const tabNumber = Number(tabIndex);
    if (tabNumber > -1 && tabNumber < paths.length) {
      history.push(paths[tabNumber]);
      return;
    }
  };

  return (
    <>
      <PageSection hasBodyWrapper={false}>
        <Title headingLevel="h1">{t('Alerting')}</Title>
        <Tabs activeKey={activeTabKey} onSelect={handleTabClick}>
          {/* Add href to tab so that when hovering you see the link in the bottom left */}
          <Tab eventKey={0} href={alertsPath} title={<TabTitleText>{t('Alerts')}</TabTitleText>} />
          <Tab
            eventKey={1}
            href={silencesPath}
            title={<TabTitleText>{t('Silences')}</TabTitleText>}
          />
          <Tab
            eventKey={2}
            href={rulesPath}
            title={<TabTitleText>{t('Alerting rules')}</TabTitleText>}
          />
        </Tabs>
      </PageSection>
      <Switch>
        <Route path={alertsPath} exact component={AlertsPage} />
        <Route path={silencesPath} exact component={SilencesPage} />
        <Route path={rulesPath} exact component={AlertRulesPage} />
      </Switch>
    </>
  );
};

export default AlertingPage;
