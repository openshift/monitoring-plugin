import { commonPages } from '../../views/common';
import { detailsPage } from '../../views/details-page';
import { listPage } from '../../views/list-page';
import { silenceAlertPage } from '../../views/silence-alert-page';
import { nav } from '../../views/nav';
import { silenceDetailsPage } from '../../views/silence-details-page';
import { silencesListPage } from '../../views/silences-list-page';
import { alertingRuleListPage } from '../../views/alerting-rule-list-page';
import { alertingRuleDetailsPage } from '../../views/alerting-rule-details-page';

//
import common = require('mocha/lib/interfaces/common');
// Set constants for the operators that need to be installed for tests.
const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

const readyTimeout = 120000;

const ALERTNAME = 'Watchdog';
const NAMESPACE = 'openshift-monitoring';
const SEVERITY = 'None';
const ALERT_DESC = 'This is an alert meant to ensure that the entire alerting pipeline is functional. This alert is always firing, therefore it should always be firing in Alertmanager and always fire against a receiver. There are integrations with various notification mechanisms that send a notification when this alert is not firing. For example the "DeadMansSnitch" integration in PagerDuty.'
const ALERT_SUMMARY = 'An alert that should always be firing to certify that Alertmanager is working properly.'

const SILENCE_COMMENT = 'test comment';

/**
   * Some documentation about this regression testing for Monitoring - Alerts:
   * - Alerting pages are ""flaky"" (in testing pov), specially SILENCES tab, always being refreshed / updated to show the latest data, due to its nature.
   * - Notice there are some "unnecessary" filters, that are not needed to be set, but to make the page a bit more stable for searching a certain alert.
   * - So, be careful with future refactoring, having in mind almost a sprint was taken to have these scenarios stable, with many tentatives to reduce unnecessary steps, but not succeed.
   */
describe('Regression: Monitoring - Alerts', () => {

  before(() => {
    cy.adminCLI(
      `oc adm policy add-cluster-role-to-user cluster-admin ${Cypress.env('LOGIN_USERNAME')}`,
    );
    // Getting the oauth url for hypershift cluster login
    cy.exec(
      `oc get oauthclient openshift-browser-client -o go-template --template="{{index .redirectURIs 0}}" --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
    ).then((result) => {
      if (expect(result.stderr).to.be.empty) {
        const oauth = result.stdout;
        // Trimming the origin part of the url
        const oauthurl = new URL(oauth);
        const oauthorigin = oauthurl.origin;
        cy.log(oauthorigin);
        cy.wrap(oauthorigin).as('oauthorigin');
      } else {
        throw new Error(`Execution of oc get oauthclient failed
          Exit code: ${result.code}
          Stdout:\n${result.stdout}
          Stderr:\n${result.stderr}`);
      }
    });
    cy.get('@oauthorigin').then((oauthorigin) => {
      cy.login(
        Cypress.env('LOGIN_IDP'),
        Cypress.env('LOGIN_USERNAME'),
        Cypress.env('LOGIN_PASSWORD'),
        oauthorigin,
      );
    });

    cy.log('Set Monitoring Plugin image in operator CSV');
    if (Cypress.env('MP_IMAGE')) {
      cy.log('MP_IMAGE is set. the image will be patched in CMO operator CSV');
      cy.exec(
        './cypress/fixtures/cmo/update-monitoring-plugin-image.sh',
        {
          env: {
            MP_IMAGE: Cypress.env('MP_IMAGE'),
            KUBECONFIG: Cypress.env('KUBECONFIG_PATH'),
            MP_NAMESPACE: `${MP.namespace}`
          },
          timeout: readyTimeout,
          failOnNonZeroExit: true
        }
      ).then((result) => {
        expect(result.code).to.eq(0);
        cy.log(`CMO CSV updated successfully with Monitoring Plugin image: ${result.stdout}`);
      });
    } else {
      cy.log('MP_IMAGE is NOT set. Skipping patching the image in CMO operator CSV.');
    }

    cy.task('clearDownloads');
  });

  after(() => {
    if (Cypress.env('MP_IMAGE')) {
      cy.log('MP_IMAGE is set. Lets revert CMO operator CSV');
      cy.exec(
        './cypress/fixtures/cmo/reenable-monitoring.sh',
        {
          env: {
            MP_IMAGE: Cypress.env('MP_IMAGE'),
            KUBECONFIG: Cypress.env('KUBECONFIG_PATH'),
            MP_NAMESPACE: `${MP.namespace}`
          },
          timeout: readyTimeout,
          failOnNonZeroExit: true
        }
      ).then((result) => {
        expect(result.code).to.eq(0);
        cy.log(`CMO CSV reverted successfully with Monitoring Plugin image: ${result.stdout}`);
      });
    } else {
      cy.log('MP_IMAGE is NOT set. Skipping reverting the image in CMO operator CSV.');
    }
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
    listPage.filter.removeMainTag('alerts-tab', 'Source');
    listPage.filter.removeIndividualTag('alerts-tab', 'Firing');
    listPage.filter.removeIndividualTag('alerts-tab', 'Pending');
    listPage.filter.removeIndividualTag('alerts-tab', 'Silenced');
    listPage.filter.clearAllFilters('alerts-tab');

    listPage.exportAsCSV(true, /openshift.csv/, `${ALERTNAME}`, `${SEVERITY}`, 'firing', 1);

    listPage.filter.byLabel('alerts-tab', 'alertname=Watchdog');
    listPage.filter.removeMainTag('alerts-tab', 'Label');
    listPage.filter.byLabel('alerts-tab', 'alertname=Watchdog');
    listPage.filter.removeIndividualTag('alerts-tab', 'alertname=Watchdog');

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
    listPage.filter.byName('alerts-tab', `${ALERTNAME}`);
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
    listPage.filter.clearAllFilters('alerts-tab');
    listPage.ARRows.expandRow();
    listPage.ARRows.assertNoKebab();
    listPage.ARRows.clickAlert();
    commonPages.titleShouldHaveText(`${ALERTNAME}`);
    detailsPage.assertSilencedAlert();

    cy.log('3.5 Assert Kebab on Silence List page for Silenced alert');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Silences');
    silencesListPage.shouldBeLoaded();
    listPage.filter.removeIndividualTag('silences', 'Active');
    listPage.filter.removeIndividualTag('silences', 'Pending');
    listPage.filter.byName('silences', `${ALERTNAME}`);
    silencesListPage.clickFilter(true,false);
    silencesListPage.selectFilterOption(false, 'Active', true);
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
    listPage.filter.removeMainTag('silences', 'Silence State');
    listPage.filter.removeMainTag('silences', 'Silence State');
    silencesListPage.selectFilterOption(true, 'Expired', false);
    silencesListPage.selectFilterOption(false, 'Active', false);
    silencesListPage.selectFilterOption(false, 'Pending', true);
    listPage.filter.byName('silences', `${ALERTNAME}`);
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
    listPage.filter.removeIndividualTag('silences', 'Pending');
    listPage.filter.byName('silences', `${ALERTNAME}`);
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
    listPage.filter.removeIndividualTag('silences', 'Active');
    listPage.filter.removeIndividualTag('silences', 'Pending');
    listPage.filter.byName('silences', `${ALERTNAME}`);
    silencesListPage.clickFilter(true,false);
    silencesListPage.selectFilterOption(false, 'Active', true);
    silencesListPage.rows.expireSilence(true);

    cy.log('3.13 Alert Details > Silence alert button > Cancel');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    listPage.filter.byName('alerts-tab', `${ALERTNAME}`);
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
    alertingRuleListPage.filter.selectFilterOption(true, 'Firing', false);
    alertingRuleListPage.filter.selectFilterOption(false, 'Pending', false);
    alertingRuleListPage.filter.selectFilterOption(false, 'Silenced', false);
    alertingRuleListPage.filter.selectFilterOption(false, 'Not Firing', false);
    alertingRuleListPage.filter.selectFilterOption(false, 'Critical', false);
    alertingRuleListPage.filter.selectFilterOption(false, 'Warning', false);
    alertingRuleListPage.filter.selectFilterOption(false, 'Info', false);
    alertingRuleListPage.filter.selectFilterOption(false, 'None', false);
    alertingRuleListPage.filter.selectFilterOption(false, 'Platform', false);
    alertingRuleListPage.filter.selectFilterOption(false, 'User', true);

    listPage.filter.clickOn1more('alerting-rules', 'Alert State');
    listPage.filter.clickOn1more('alerting-rules', 'Severity');

    listPage.filter.clickOnShowLess('alerting-rules', 'Alert State');
    listPage.filter.clickOnShowLess('alerting-rules', 'Severity');

    listPage.filter.removeIndividualTag('alerting-rules', 'Firing');
    listPage.filter.removeIndividualTag('alerting-rules', 'Pending');
    listPage.filter.removeIndividualTag('alerting-rules', 'Silenced');
    listPage.filter.removeIndividualTag('alerting-rules', 'Not Firing');

    listPage.filter.removeMainTag('alerting-rules', 'Severity');
    listPage.filter.removeMainTag('alerting-rules', 'Source');

    alertingRuleListPage.filter.assertNoClearAllFilters();

    cy.log('4.3 Search by Name');
    listPage.filter.byName('alerting-rules', `${ALERTNAME}`);
    alertingRuleListPage.countShouldBe(1);
    listPage.filter.clearAllFilters('alerting-rules');

    cy.log('4.4 Search by Label');
    listPage.filter.byLabel('alerting-rules', `namespace=${NAMESPACE}`);
    listPage.filter.clearAllFilters('alerting-rules');

    cy.log('4.5 Search by Name and see details');
    listPage.filter.byName('alerting-rules', `${ALERTNAME}`);
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
    listPage.filter.clearAllFilters('alerting-rules');
    listPage.filter.byName('alerting-rules', `${ALERTNAME}`);
    alertingRuleListPage.clickAlertingRule(`${ALERTNAME}`);
    alertingRuleDetailsPage.assertNoKebab();

    cy.log('4.8 Expire silence');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Silences');
    silencesListPage.shouldBeLoaded();
    listPage.filter.removeIndividualTag('silences', 'Active');
    listPage.filter.removeIndividualTag('silences', 'Pending');
    listPage.filter.byName('silences', `${ALERTNAME}`);
    silencesListPage.clickFilter(true,false);
    silencesListPage.selectFilterOption(false, 'Active', true);
    silencesListPage.rows.expireSilence(true);

  });

});
