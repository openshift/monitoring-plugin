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
import { AlertsAlertState, SilenceComment, SilenceState, WatchdogAlert } from '../../fixtures/monitoring/constants';
import { alerts } from '../../fixtures/monitoring/alert';
import { alertingRuleListPage } from '../../views/alerting-rule-list-page';
// Set constants for the operators that need to be installed for tests.
const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

describe('BVT: Monitoring - namespaced', () => {

  before(() => {
    cy.beforeBlock(MP);
  });

  beforeEach(() => {
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    cy.changeNamespace(MP.namespace);
  });

  afterEach(() => {
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    cy.changeNamespace('All Projects');
  });

  it('1. Admin perspective - Observe Menu', () => {
    cy.visit('/');
    cy.log('Admin perspective - Observe Menu and verify all submenus');
    nav.sidenav.clickNavLink(['Administration', 'Cluster Settings']);
    commonPages.detailsPage.administration_clusterSettings();
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    commonPages.titleShouldHaveText('Alerting');
    nav.tabs.switchTab('Silences');
    commonPages.projectDropdownShouldExist();
    nav.tabs.switchTab('Alerting rules');
    commonPages.projectDropdownShouldExist();
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    commonPages.titleShouldHaveText('Metrics');
    commonPages.projectDropdownShouldExist();
    nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
    commonPages.titleShouldHaveText('Dashboards');
    commonPages.projectDropdownShouldExist();
    nav.sidenav.clickNavLink(['Observe', 'Targets']);
    commonPages.titleShouldHaveText('Metrics targets');
    commonPages.projectDropdownShouldNotExist();

  });

  it('2. Admin perspective - Overview Page > Status - View alerts', () => {
    cy.visit('/');
    nav.sidenav.clickNavLink(['Home', 'Overview']);
    overviewPage.clickStatusViewAlerts();
    commonPages.titleShouldHaveText('Alerting');
  });

  it('3. Admin perspective - Cluster Utilization - Metrics', () => {
    cy.visit('/');
    nav.sidenav.clickNavLink(['Home', 'Overview']);
    overviewPage.clickClusterUtilizationViewCPU();
    commonPages.titleShouldHaveText('Metrics');
  });


  it('4. Admin perspective - Alerting > Alerting Details page > Alerting Rule > Metrics', () => {
    cy.visit('/');
    cy.log('4.1. use sidebar nav to go to Observe > Alerting');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    commonPages.titleShouldHaveText('Alerting');
    listPage.tabShouldHaveText('Alerts');
    listPage.tabShouldHaveText('Silences');
    listPage.tabShouldHaveText('Alerting rules');
    commonPages.linkShouldExist('Export as CSV');
    commonPages.linkShouldExist('Clear all filters');
    listPage.ARRows.shouldBeLoaded();

    cy.log('4.2. filter Alerts and click on Alert');
    listPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    listPage.ARRows.countShouldBe(1);
    listPage.ARRows.ARShouldBe(`${WatchdogAlert.ALERTNAME}`, `${WatchdogAlert.SEVERITY}`, 1, 'Firing');
    listPage.ARRows.expandRow();
    listPage.ARRows.AShouldBe(`${WatchdogAlert.ALERTNAME}`, `${WatchdogAlert.SEVERITY}`, `${WatchdogAlert.NAMESPACE}`);
    listPage.ARRows.clickAlert();

    cy.log('4.3. click on Alert Details Page');
    commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
    commonPages.detailsPage.common(`${WatchdogAlert.ALERTNAME}`, `${WatchdogAlert.SEVERITY}`);
    commonPages.detailsPage.alert(`${WatchdogAlert.ALERTNAME}`);

    const timeIntervalValue = getValFromElement(`[data-ouia-component-id^="OUIA-Generated-TextInputBase"]`);
    timeIntervalValue.then((value) => {
      expect(value).to.not.be.empty;
    });

    cy.log('4.4. click on Alert Rule link');
    detailsPage.clickAlertRule(`${WatchdogAlert.ALERTNAME}`);
    commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
    commonPages.detailsPage.alertRule;
    commonPages.detailsPage.common(`${WatchdogAlert.ALERTNAME}`, `${WatchdogAlert.SEVERITY}`);
    cy.get(`[class="pf-v6-c-code-block__content"]`).invoke('text').then((expText) => {
      cy.log(`${expText}`);
      cy.wrap(expText).as('alertExpression');
      });
    

    cy.log('4.5. click on Alert Details Page');
    detailsPage.clickAlertDesc(`${WatchdogAlert.ALERT_DESC}`);
    commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
    commonPages.detailsPage.common(`${WatchdogAlert.ALERTNAME}`, `${WatchdogAlert.SEVERITY}`);
    commonPages.detailsPage.alert(`${WatchdogAlert.ALERTNAME}`);

    cy.log('4.6. click on Inspect on Alert Details Page');
    detailsPage.clickInspectAlertPage();

    cy.log('4.7. Metrics page is loaded');
    commonPages.titleShouldHaveText('Metrics');

    cy.log('4.8. Assert Expression');
    cy.get('[class="cm-line"]').should('be.visible');
    cy.get(`@alertExpression`).then((expText) => {
      cy.log(`${expText}`);
      cy.get('[class="cm-line"]').invoke('text').should('equal', `${expText}`);
    });
  });

  it('5. Admin perspective - Creates and expires a Silence', () => {
    cy.visit('/');
    cy.log('5.1 use sidebar nav to go to Observe > Alerting');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    alerts.getWatchdogAlert();

    cy.log('5.2 filter to Watchdog alert');
    nav.tabs.switchTab('Alerts');
    listPage.ARRows.shouldBeLoaded();
    listPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    listPage.ARRows.countShouldBe(1);

    cy.log('5.3 silence alert');
    listPage.ARRows.expandRow();
    listPage.ARRows.silenceAlert();

    cy.log('5.4 silence alert page');
    commonPages.titleShouldHaveText('Silence alert');
    commonPages.projectDropdownShouldExist();

    // Launches create silence form
    silenceAlertPage.silenceAlertSectionDefault();
    silenceAlertPage.durationSectionDefault();
    silenceAlertPage.alertLabelsSectionDefault();
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('alertname', `${WatchdogAlert.ALERTNAME}`, false, false);
    // silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('severity', `${SEVERITY}`, false, false);
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('namespace', `${WatchdogAlert.NAMESPACE}`, false, false);
    silenceAlertPage.assertNamespaceLabelNamespaceValueDisabled('namespace', `${WatchdogAlert.NAMESPACE}`, true);
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
    silenceAlertPage.addComment(SilenceComment.SILENCE_COMMENT);
    silenceAlertPage.clickSubmit();

    // After creating the Silence, should be redirected to its details page
    cy.log('5.5 Assert Silence details page');
    silenceDetailsPage.assertSilenceDetailsPage(`${WatchdogAlert.ALERTNAME}`, 'Silence details', 'alertname=Watchdog');
    commonPages.projectDropdownShouldNotExist();

    cy.log('5.6 Click on Firing alerts');
    silenceDetailsPage.clickOnFiringAlerts(`${WatchdogAlert.ALERTNAME}`);
    commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
    commonPages.projectDropdownShouldNotExist();
    detailsPage.sectionHeaderShouldExist('Alert details');
    detailsPage.labelShouldExist('alertname=Watchdog');

    cy.log('5.7 Click on Silenced by');
    detailsPage.clickOnSilencedBy(`${WatchdogAlert.ALERTNAME}`);
    commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
    detailsPage.sectionHeaderShouldExist('Silence details');
    detailsPage.labelShouldExist('alertname=Watchdog');

    cy.log('5.8 shows the silenced Alert in the Silenced Alerts list');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Silences');
    silencesListPage.shouldBeLoaded();
    listPage.filter.removeIndividualTag(SilenceState.ACTIVE);
    listPage.filter.removeIndividualTag(SilenceState.PENDING);
    silencesListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    listPage.filter.clickFilter(true, false);
    listPage.filter.selectFilterOption(false, SilenceState.ACTIVE, true);
    silencesListPage.rows.shouldBe(`${WatchdogAlert.ALERTNAME}`, SilenceState.ACTIVE);

    cy.log('5.9.1 verify on Alerting Rules list page again');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Alerting rules');
    listPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    alertingRuleListPage.ARShouldBe(`${WatchdogAlert.ALERTNAME}`, `${WatchdogAlert.SEVERITY}`, 1, AlertsAlertState.SILENCED);

    cy.log('5.10 verify on Alerts list page again');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    listPage.filter.clearAllFilters();
    listPage.filter.selectFilterOption(true, AlertsAlertState.SILENCED, true);
    listPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    listPage.ARRows.ARShouldBe(`${WatchdogAlert.ALERTNAME}`, `${WatchdogAlert.SEVERITY}`, 1, AlertsAlertState.SILENCED);

    cy.log('5.11 expires the Silence');
    listPage.ARRows.expandRow();
    listPage.ARRows.clickAlert();
    detailsPage.clickOnSilencedBy(`${WatchdogAlert.ALERTNAME}`);
    silenceDetailsPage.expireSilence(true, true);


    cy.log('5.12 verify on Alerts list page again');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    listPage.filter.clearAllFilters();
    listPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    listPage.ARRows.ARShouldBe(`${WatchdogAlert.ALERTNAME}`, `${WatchdogAlert.SEVERITY}`, 1, AlertsAlertState.FIRING);

  });
});
