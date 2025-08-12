import { commonPages } from '../../../views/common';
import { detailsPage } from '../../../views/details-page';
import { listPage } from '../../../views/list-page';
import { silenceAlertPage } from '../../../views/silence-alert-page';
import { nav } from '../../../views/nav';
import { silenceDetailsPage } from '../../../views/silence-details-page';
import { silencesListPage } from '../../../views/silences-list-page';
import { alertingRuleListPage } from '../../../views/alerting-rule-list-page';
import { alertingRuleDetailsPage } from '../../../views/alerting-rule-details-page';

//
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

describe('Regression: Monitoring - Alerts', () => {

  before(() => {
    cy.beforeBlock(MP);
  });

  after(() => {
    cy.afterBlock(MP);
  });

  it('1. Admin perspective - Alerting > Alerts page - Filtering', () => {
    cy.log('1.1 Header components');
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

    listPage.filter.selectFilterOption(true, 'Pending', false);
    listPage.filter.selectFilterOption(false, 'Silenced', false);
    listPage.filter.selectFilterOption(false, 'Critical', false);
    listPage.filter.selectFilterOption(false, 'Warning', false);
    listPage.filter.selectFilterOption(false, 'Info', false);
    listPage.filter.selectFilterOption(false, 'None', false);
    listPage.filter.selectFilterOption(false, 'User', true);
    listPage.filter.removeMainTag('Source');
    listPage.filter.removeIndividualTag('Firing');
    listPage.filter.removeIndividualTag( 'Pending');
    listPage.filter.removeIndividualTag('Silenced');
    listPage.filter.clearAllFilters();

    listPage.exportAsCSV(true, /openshift.csv/, `${ALERTNAME}`, `${SEVERITY}`, 'firing', 1);

    listPage.filter.byLabel('alertname=Watchdog');
    listPage.filter.removeMainTag('Label');
    listPage.filter.byLabel('alertname=Watchdog');
    listPage.filter.removeIndividualTag('alertname=Watchdog');

  });

  it('2. Admin perspective - Alerting > Silences page > Create silence', () => {
    cy.log('2.1 use sidebar nav to go to Observe > Alerting');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Silences');
    silencesListPage.createSilence();
    silenceAlertPage.assertCommentNoError();
    silenceAlertPage.clickSubmit();
    silenceAlertPage.assertCommentWithError();
    silenceAlertPage.addComment('testing');
    silenceAlertPage.addCreator('');
    silenceAlertPage.clickSubmit();
    silenceAlertPage.assertCreatorWithError();
    silenceAlertPage.addCreator(Cypress.env('LOGIN_USERNAME'));
    silenceAlertPage.fillLabeNameLabelValue('', 'a');
    silenceAlertPage.clickSubmit();
    silenceAlertPage.assertLabelNameError();
    silenceAlertPage.fillLabeNameLabelValue('a', '');
    silenceAlertPage.clickSubmit();
    silenceAlertPage.assertLabelValueError();

  });

  it('3. Admin perspective - Alerting > Alerts / Silences > Kebab icon on List and Details', () => {
    cy.visit('/');
    cy.log('3.1 use sidebar nav to go to Observe > Alerting');
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

    listPage.ARRows.shouldBeLoaded();

    cy.log('3.2 filter to Watchdog alert');
    listPage.filter.byName(`${ALERTNAME}`);
    listPage.ARRows.countShouldBe(1);


    cy.log('3.3 silence alert');
    listPage.ARRows.expandRow();
    listPage.ARRows.silenceAlert();
    silenceAlertPage.addComment(SILENCE_COMMENT);
    silenceAlertPage.clickSubmit();
    commonPages.titleShouldHaveText(`${ALERTNAME}`);

    cy.log('3.4 Assert Kebab on Alert Details page');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    commonPages.titleShouldHaveText('Alerting');
    listPage.filter.clearAllFilters();
    listPage.ARRows.expandRow();
    listPage.ARRows.assertNoKebab();
    listPage.ARRows.clickAlert();
    commonPages.titleShouldHaveText(`${ALERTNAME}`);
    detailsPage.assertSilencedAlert();

    cy.log('3.5 Assert Kebab on Silence List page for Silenced alert');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Silences');
    silencesListPage.shouldBeLoaded();
    listPage.filter.removeIndividualTag('Active');
    listPage.filter.removeIndividualTag('Pending');
    silencesListPage.filter.byName(`${ALERTNAME}`);
    listPage.filter.clickFilter(true,false);
    listPage.filter.selectFilterOption(false, 'Active', true);
    silencesListPage.rows.assertSilencedAlertKebab();

    cy.log('3.6 Click on Silenced alert and Assert Actions button');
    silencesListPage.rows.clickSilencedAlert(`${ALERTNAME}`);
    commonPages.titleShouldHaveText(`${ALERTNAME}`);
    silenceDetailsPage.assertActionsSilencedAlert();

    cy.log('3.7 Expire silence');
    silenceDetailsPage.expireSilence(false, true);
    commonPages.titleShouldHaveText(`${ALERTNAME}`);
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Silences');

    cy.log('3.8 Assert Kebab on Silence List page for Expired alert');
    silencesListPage.emptyState();
    listPage.filter.removeMainTag('Silence State');
    listPage.filter.selectFilterOption(true, 'Expired', false);
    listPage.filter.selectFilterOption(false, 'Active', false);
    listPage.filter.selectFilterOption(false, 'Pending', true);
    silencesListPage.filter.byName(`${ALERTNAME}`);
    silencesListPage.rows.assertExpiredAlertKebab('0');

    cy.log('3.9 Click on Expired alert and Assert Actions button');
    silencesListPage.rows.clickSilencedAlert(`${ALERTNAME}`);
    commonPages.titleShouldHaveText(`${ALERTNAME}`);
    silenceDetailsPage.assertActionsExpiredAlert();

    cy.log('3.10 Recreate silence');
    silenceDetailsPage.recreateSilence(false);
    commonPages.titleShouldHaveText('Recreate silence');
    silenceAlertPage.silenceAlertSectionDefault();
    silenceAlertPage.durationSectionDefault();
    silenceAlertPage.alertLabelsSectionDefault();
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('alertname', `${ALERTNAME}`, false, false);
    // silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('severity', `${SEVERITY}`, false, false);
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('namespace', `${NAMESPACE}`, false, false);
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('prometheus', 'openshift-monitoring/k8s', false, false);
    silenceAlertPage.clickSubmit();
    commonPages.titleShouldHaveText(`${ALERTNAME}`);

    cy.log('3.11 Edit silence');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Silences');
    silencesListPage.shouldBeLoaded();
    listPage.filter.removeIndividualTag('Pending');
    silencesListPage.filter.byName( `${ALERTNAME}`);
    silencesListPage.rows.editSilence();
    commonPages.titleShouldHaveText('Edit silence');
    silenceAlertPage.silenceAlertSectionDefault();
    silenceAlertPage.editAlertWarning();
    silenceAlertPage.editDurationSectionDefault();
    silenceAlertPage.alertLabelsSectionDefault();
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('alertname', `${ALERTNAME}`, false, false);
    // silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('severity', `${SEVERITY}`, false, false);
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('namespace', `${NAMESPACE}`, false, false);
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('prometheus', 'openshift-monitoring/k8s', false, false);
    silenceAlertPage.clickSubmit();
    commonPages.titleShouldHaveText(`${ALERTNAME}`);

    cy.log('3.12 Expire silence');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Silences');
    silencesListPage.shouldBeLoaded(); silencesListPage.shouldBeLoaded();
    listPage.filter.removeIndividualTag('Active');
    listPage.filter.removeIndividualTag('Pending');
    silencesListPage.filter.byName(`${ALERTNAME}`);
    listPage.filter.clickFilter(true,false);
    listPage.filter.selectFilterOption(false, 'Active', true);
    silencesListPage.rows.expireSilence(true);

    cy.log('3.13 Alert Details > Silence alert button > Cancel');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    listPage.filter.byName(`${ALERTNAME}`);
    listPage.ARRows.countShouldBe(1);
    listPage.ARRows.expandRow();
    listPage.ARRows.clickAlert();
    commonPages.titleShouldHaveText(`${ALERTNAME}`);
    detailsPage.clickSilenceAlertButton();
    silenceAlertPage.addComment(SILENCE_COMMENT);
    silenceAlertPage.clickCancelButton();
    commonPages.titleShouldHaveText(`${ALERTNAME}`);
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    listPage.ARRows.countShouldBe(1);
  });

  it('4. Admin perspective - Alerting > Alerting Rules', () => {
    cy.log('4.1 use sidebar nav to go to Observe > Alerting');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Alerting rules');
    alertingRuleListPage.shouldBeLoaded();

    cy.log('4.2 clear all filters, verify filters and tags');
    // listPage.filter.clearAllFilters('alerting-rules');
    listPage.filter.selectFilterOption(true, 'Firing', false);
    listPage.filter.selectFilterOption(false, 'Pending', false);
    listPage.filter.selectFilterOption(false, 'Silenced', false);
    listPage.filter.selectFilterOption(false, 'Not Firing', false);
    listPage.filter.selectFilterOption(false, 'Critical', false);
    listPage.filter.selectFilterOption(false, 'Warning', false);
    listPage.filter.selectFilterOption(false, 'Info', false);
    listPage.filter.selectFilterOption(false, 'None', false);
    listPage.filter.selectFilterOption(false, 'Platform', false);
    listPage.filter.selectFilterOption(false, 'User', true);

    listPage.filter.clickOn1more('Alert State');
    listPage.filter.clickOn1more('Severity');

    listPage.filter.clickOnShowLess('Alert State');
    listPage.filter.clickOnShowLess('Severity');

    listPage.filter.removeIndividualTag('Firing');
    listPage.filter.removeIndividualTag('Pending');
    listPage.filter.removeIndividualTag('Silenced');
    listPage.filter.removeIndividualTag('Not Firing');

    listPage.filter.removeMainTag('Severity');
    listPage.filter.removeMainTag('Source');

    alertingRuleListPage.filter.assertNoClearAllFilters();

    cy.log('4.3 Search by Name');
    listPage.filter.byName(`${ALERTNAME}`);
    alertingRuleListPage.countShouldBe(1);
    listPage.filter.clearAllFilters();

    cy.log('4.4 Search by Label');
    listPage.filter.byLabel(`namespace=${NAMESPACE}`);
    listPage.filter.clearAllFilters();

    cy.log('4.5 Search by Name and see details');
    listPage.filter.byName(`${ALERTNAME}`);
    alertingRuleListPage.countShouldBe(1);
    alertingRuleListPage.clickAlertingRule(`${ALERTNAME}`);
    alertingRuleDetailsPage.assertAlertingRuleDetailsPage(`${ALERTNAME}`);

    cy.log('4.6 Alerting rule details > Silence alert');
    alertingRuleDetailsPage.clickOnKebabSilenceAlert();
    silenceAlertPage.addComment(SILENCE_COMMENT);
    silenceAlertPage.clickSubmit();
    commonPages.titleShouldHaveText(`${ALERTNAME}`);

    cy.log('4.7 Alerting rule details > Assert Kebab');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Alerting rules');
    listPage.filter.clearAllFilters();
    listPage.filter.byName(`${ALERTNAME}`);
    alertingRuleListPage.clickAlertingRule(`${ALERTNAME}`);
    alertingRuleDetailsPage.assertNoKebab();

    cy.log('4.8 Expire silence');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Silences');
    silencesListPage.shouldBeLoaded();
    listPage.filter.removeIndividualTag('Active');
    listPage.filter.removeIndividualTag('Pending');
    silencesListPage.filter.byName(`${ALERTNAME}`);
    listPage.filter.clickFilter(true,false);
    listPage.filter.selectFilterOption(false, 'Active', true);
    silencesListPage.rows.expireSilence(true);

  });

});
