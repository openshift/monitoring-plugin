import { commonPages } from '../../views/common';
import { detailsPage } from '../../views/details-page';
import { listPage } from '../../views/list-page';
import { silenceAlertPage } from '../../views/silence-alert-page';
import { nav } from '../../views/nav';
import { silenceDetailsPage } from '../../views/silence-details-page';
import { silencesListPage } from '../../views/silences-list-page';
import { getValFromElement } from '../../views/utils';

import { overviewPage } from '../../views/overview-page';
import common = require('mocha/lib/interfaces/common');
// Set constants for the operators that need to be installed for tests.
const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

const ALERTNAME = 'Watchdog';
const NAMESPACE = 'openshift-monitoring';
const SEVERITY = 'None';
const ALERT_DESC = 'This is an alert meant to ensure that the entire alerting pipeline is functional. This alert is always firing, therefore it should always be firing in Alertmanager and always fire against a receiver. There are integrations with various notification mechanisms that send a notification when this alert is not firing. For example the "DeadMansSnitch" integration in PagerDuty.'
const ALERT_SUMMARY = 'An alert that should always be firing to certify that Alertmanager is working properly.'

const SILENCE_COMMENT = 'test comment';



describe('BVT: Monitoring', () => {

  before(() => {
    cy.beforeBlock(MP);
  });

  after(() => {
    cy.afterBlock(MP);
  });

  it('1. Admin perspective - Observe Menu', () => {
    cy.visit('/');
    cy.log('Admin perspective - Observe Menu and verify all submenus');
    nav.sidenav.clickNavLink(['Administration', 'Cluster Settings']);
    commonPages.detailsPage.administration_clusterSettings();
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    commonPages.titleShouldHaveText('Alerting');
    nav.tabs.switchTab('Silences');
    silencesListPage.firstTimeEmptyState();
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    commonPages.titleShouldHaveText('Metrics');
    nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
    commonPages.titleShouldHaveText('Dashboards');
    nav.sidenav.clickNavLink(['Observe', 'Targets']);
    commonPages.titleShouldHaveText('Metrics targets');


  });
  // TODO: Intercept Bell GET request to inject an alert (Watchdog to have it opened in Alert Details page?)
  // it('Admin perspective - Bell > Alert details > Alerting rule details > Metrics flow', () => {
  //   cy.visit('/');
  //   commonPages.clickBellIcon();
  //   commonPages.bellIconClickAlert('TargetDown');
  //   commonPages.titleShouldHaveText('TargetDown')

  // });


  it('2. Admin perspective - Overview Page > Status - View alerts', () => {
    cy.visit('/');
    nav.sidenav.clickNavLink(['Home', 'Overview']);
    overviewPage.clickStatusViewAlerts();
    commonPages.titleShouldHaveText('Alerting');
  });

  //TODO: Intercept and inject a valid alert into status-card to be opened correctly to Alerting / Alerts page
  // I couldn't make Watchdog working on status-card
  // it('3. Admin perspective - Overview Page > Status - View details', () => {
  //   cy.visit('/');
  //   nav.sidenav.clickNavLink(['Home', 'Overview']);
  //   overviewPage.clickStatusViewDetails(0);
  //   detailsPage.sectionHeaderShouldExist('Alert details');
  // });

  it('4. Admin perspective - Cluster Utilization - Metrics', () => {
    cy.visit('/');
    nav.sidenav.clickNavLink(['Home', 'Overview']);
    overviewPage.clickClusterUtilizationViewCPU();
    commonPages.titleShouldHaveText('Metrics');
  });


  it('5. Admin perspective - Alerting > Alerting Details page > Alerting Rule > Metrics', () => {
    cy.visit('/');
    cy.log('5.1. use sidebar nav to go to Observe > Alerting');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    commonPages.titleShouldHaveText('Alerting');
    commonPages.projectDropdownShouldNotExist();
    listPage.tabShouldHaveText('Alerts');
    listPage.tabShouldHaveText('Silences');
    listPage.tabShouldHaveText('Alerting rules');
    commonPages.linkShouldExist('Export as CSV');
    commonPages.linkShouldExist('Clear all filters');
    listPage.ARRows.shouldBeLoaded();

    cy.log('5.2. filter Alerts and click on Alert');
    listPage.filter.byName(`${ALERTNAME}`);
    listPage.ARRows.countShouldBe(1);
    listPage.ARRows.ARShouldBe(`${ALERTNAME}`, `${SEVERITY}`, 1, 'Firing');
    listPage.ARRows.expandRow();
    listPage.ARRows.AShouldBe(`${ALERTNAME}`, `${SEVERITY}`, `${NAMESPACE}`);
    listPage.ARRows.clickAlert();

    cy.log('5.3. click on Alert Details Page');
    commonPages.titleShouldHaveText(`${ALERTNAME}`);
    commonPages.detailsPage.common(`${ALERTNAME}`, `${SEVERITY}`);
    commonPages.detailsPage.alert(`${ALERTNAME}`);

    const timeIntervalValue = getValFromElement(`[data-ouia-component-id^="OUIA-Generated-TextInputBase"]`);
    timeIntervalValue.then((value) => {
      expect(value).to.not.be.empty;
    });

    cy.log('5.4. click on Alert Rule link');
    detailsPage.clickAlertRule(`${ALERTNAME}`);
    commonPages.titleShouldHaveText(`${ALERTNAME}`);
    commonPages.detailsPage.alertRule;
    commonPages.detailsPage.common(`${ALERTNAME}`, `${SEVERITY}`);
    cy.get(`[class="pf-v6-c-code-block__content"]`).invoke('text').then((expText) => {
      cy.log(`${expText}`);
      cy.wrap(expText).as('alertExpression');
    });

    cy.log('5.5. click on Alert Details Page');
    detailsPage.clickAlertDesc(`${ALERT_DESC}`);
    commonPages.titleShouldHaveText(`${ALERTNAME}`);
    commonPages.detailsPage.common(`${ALERTNAME}`, `${SEVERITY}`);
    commonPages.detailsPage.alert(`${ALERTNAME}`);

    cy.log('5.6. click on Inspect on Alert Details Page');
    detailsPage.clickInspectAlertPage();

    cy.log('5.7. Metrics page is loaded');
    commonPages.titleShouldHaveText('Metrics');

    cy.log('5.8. Assert Expression');
    cy.get('[class="cm-line"]').should('be.visible');
    cy.get(`@alertExpression`).then((expText) => {
      cy.log(`${expText}`);
      cy.get('[class="cm-line"]').invoke('text').should('equal', `${expText}`);
    });
  });

  it('6. Admin perspective - Creates and expires a Silence', () => {
    cy.visit('/');
    cy.log('6.1 use sidebar nav to go to Observe > Alerting');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);

    cy.intercept('GET', '/api/prometheus/api/v1/rules?', {
      data: {
        groups: [
          {
            file: 'dummy-file',
            interval: 30,
            name: 'general.rules',
            rules: [
              {
                state: 'firing',
                name: `${ALERTNAME}`,
                query: 'vector(1)',
                duration: 0,
                labels: {
                  // namespace: `${NAMESPACE}`,
                  prometheus: 'openshift-monitoring/k8s',
                  severity: `${SEVERITY}`,
                },
                annotations: {
                  description:
                    `${ALERT_DESC}`,
                  summary:
                    `${ALERT_SUMMARY}`,
                },
                alerts: [
                  {
                    labels: {
                      alertname: `${ALERTNAME}`,
                      namespace: `${NAMESPACE}`,
                      severity: `${SEVERITY}`,
                    },
                    annotations: {
                      description:
                        `${ALERT_DESC}`,
                      summary:
                        `${ALERT_SUMMARY}`,
                    },
                    state: 'firing',
                    activeAt: '2023-04-10T12:00:00.123456789Z',
                    value: '1e+00',
                    'partialResponseStrategy': 'WARN',
                  },
                ],
                health: 'ok',
                type: 'alerting',
              },
            ],
          },
        ],
      },
    });

    cy.log('6.3 filter to Watchdog alert');
    nav.tabs.switchTab('Alerts');
    listPage.ARRows.shouldBeLoaded();
    listPage.filter.byName(`${ALERTNAME}`);
    listPage.ARRows.countShouldBe(1);

    cy.log('6.4 silence alert');
    listPage.ARRows.expandRow();
    listPage.ARRows.silenceAlert();

    cy.log('6.5 silence alert page');
    commonPages.titleShouldHaveText('Silence alert');

    // Launches create silence form
    silenceAlertPage.silenceAlertSectionDefault();
    silenceAlertPage.durationSectionDefault();
    silenceAlertPage.alertLabelsSectionDefault();
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('alertname', `${ALERTNAME}`, false, false);
    // silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('severity', `${SEVERITY}`, false, false);
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('namespace', `${NAMESPACE}`, false, false);
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('prometheus', 'openshift-monitoring/k8s', false, false);

    // Change duration
    silenceAlertPage.setForAndStartImmediately('1h', true);
    // Change to not start now
    silenceAlertPage.setForAndStartImmediately('2h', false);
    // Invalid start time
    silenceAlertPage.setSilenceFrom('abc');
    cy.byTestID('silence-until').should('have.value', '-');
    // Change to back to start now
    silenceAlertPage.setForAndStartImmediately('1h', true);
    // Change duration back again
    silenceAlertPage.setForAndStartImmediately('2h', true);
    // Add comment and submit
    silenceAlertPage.addComment(SILENCE_COMMENT);
    silenceAlertPage.clickSubmit();

    // After creating the Silence, should be redirected to its details page
    cy.log('6.6 Assert Silence details page');
    silenceDetailsPage.assertSilenceDetailsPage(`${ALERTNAME}`, 'Silence details', 'alertname=Watchdog');

    cy.log('6.7 Click on Firing alerts');
    silenceDetailsPage.clickOnFiringAlerts(`${ALERTNAME}`);
    commonPages.titleShouldHaveText(`${ALERTNAME}`);
    detailsPage.sectionHeaderShouldExist('Alert details');
    detailsPage.labelShouldExist('alertname=Watchdog');

    cy.log('6.8 Click on Silenced by');
    detailsPage.clickOnSilencedBy(`${ALERTNAME}`);
    commonPages.titleShouldHaveText(`${ALERTNAME}`);
    detailsPage.sectionHeaderShouldExist('Silence details');
    detailsPage.labelShouldExist('alertname=Watchdog');

    cy.log('6.9 shows the silenced Alert in the Silenced Alerts list');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Silences');
    silencesListPage.shouldBeLoaded();
    listPage.filter.removeIndividualTag('Active');
    listPage.filter.removeIndividualTag('Pending');
    silencesListPage.filter.byName(`${ALERTNAME}`);
    listPage.filter.clickFilter(true, false);
    listPage.filter.selectFilterOption(false, 'Active', true);
    silencesListPage.rows.shouldBe(`${ALERTNAME}`, 'Active');

    cy.log('6.10 verify on Alerts list page again');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    listPage.filter.clearAllFilters();
    listPage.filter.selectFilterOption(true, 'Silenced', true);
    listPage.filter.byName(`${ALERTNAME}`);
    listPage.ARRows.ARShouldBe(`${ALERTNAME}`, `${SEVERITY}`, 1, 'Silenced');

    cy.log('6.11 expires the Silence');
    listPage.ARRows.expandRow();
    listPage.ARRows.clickAlert();
    detailsPage.expireSilence(true);

    cy.log('6.12 verify on Alerts list page again');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    listPage.filter.clearAllFilters();
    listPage.filter.byName(`${ALERTNAME}`);
    listPage.ARRows.ARShouldBe(`${ALERTNAME}`, `${SEVERITY}`, 1, 'Firing');

  });
});
