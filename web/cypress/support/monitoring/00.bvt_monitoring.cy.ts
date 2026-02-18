import { commonPages } from '../../views/common';
import { detailsPage } from '../../views/details-page';
import { listPage } from '../../views/list-page';
import { silenceAlertPage } from '../../views/silence-alert-page';
import { nav } from '../../views/nav';
import { silenceDetailsPage } from '../../views/silence-details-page';
import { silencesListPage } from '../../views/silences-list-page';
import { getValFromElement } from '../../views/utils';
import { AlertsAlertState, SilenceComment, SilenceState, WatchdogAlert } from '../../fixtures/monitoring/constants';
import { alertingRuleListPage } from '../../views/alerting-rule-list-page';
import { Classes } from '../../../src/components/data-test';
import { alerts } from '../../fixtures/monitoring/alert';

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

export function runBVTMonitoringTests(perspective: PerspectiveConfig) {
  testBVTMonitoring(perspective);
}

export function testBVTMonitoring(perspective: PerspectiveConfig) {

  it(`${perspective.name} perspective - Alerting > Alerting Details page > Alerting Rule > Metrics`, () => {
    cy.log('5.1. use sidebar nav to go to Observe > Alerting');
    commonPages.titleShouldHaveText('Alerting');
    listPage.tabShouldHaveText('Alerts');
    listPage.tabShouldHaveText('Silences');
    listPage.tabShouldHaveText('Alerting rules');
    commonPages.linkShouldExist('Export as CSV');
    commonPages.linkShouldExist('Clear all filters');
    listPage.ARRows.shouldBeLoaded();

    cy.log('5.2. filter Alerts and click on Alert');
    listPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    listPage.ARRows.countShouldBe(1);
    listPage.ARRows.AShouldBe(`${WatchdogAlert.ALERTNAME}`);
    listPage.ARRows.clickAlert();

    cy.log('5.3. click on Alert Details Page');
    commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
    commonPages.detailsPage.common(`${WatchdogAlert.ALERTNAME}`, `${WatchdogAlert.SEVERITY}`);
    commonPages.detailsPage.alert(`${WatchdogAlert.ALERTNAME}`);

    const timeIntervalValue = getValFromElement(`[data-ouia-component-id^="OUIA-Generated-TextInputBase"]`);
    timeIntervalValue.then((value) => {
      expect(value).to.not.be.empty;
    });

    cy.log('5.4. click on Alert Rule link');
    detailsPage.clickAlertRule(`${WatchdogAlert.ALERTNAME}`);
    commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
    commonPages.detailsPage.alertRule;
    commonPages.detailsPage.common(`${WatchdogAlert.ALERTNAME}`, `${WatchdogAlert.SEVERITY}`);
    cy.get(Classes.Expression).invoke('text').then((expText) => {
      cy.log(`${expText}`);
      cy.wrap(expText).as('alertExpression');
    });


    cy.log('5.5. click on Alert Details Page');
    detailsPage.clickAlertDesc(`${WatchdogAlert.ALERT_DESC}`);
    commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
    commonPages.detailsPage.common(`${WatchdogAlert.ALERTNAME}`, `${WatchdogAlert.SEVERITY}`);
    commonPages.detailsPage.alert(`${WatchdogAlert.ALERTNAME}`);

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

  it(`${perspective.name} perspective - Creates and expires a Silence`, () => {
    cy.log('6.1 filter to Watchdog alert');
    nav.tabs.switchTab('Alerts');
    listPage.ARRows.shouldBeLoaded();
    listPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    listPage.ARRows.countShouldBe(1);

    cy.log('6.2 silence alert');
    listPage.ARRows.silenceAlert();

    cy.log('6.3 silence alert page');
    commonPages.titleShouldHaveText('Silence alert');

    // Launches create silence form
    silenceAlertPage.silenceAlertSectionDefault();
    silenceAlertPage.durationSectionDefault();
    silenceAlertPage.alertLabelsSectionDefault();
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('alertname', `${WatchdogAlert.ALERTNAME}`);
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('namespace', `${WatchdogAlert.NAMESPACE}`);
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('prometheus', 'openshift-monitoring/k8s');

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
    cy.log('6.4 Assert Silence details page');
    silenceDetailsPage.assertSilenceDetailsPage(`${WatchdogAlert.ALERTNAME}`, 'Silence details', 'alertname=Watchdog');

    cy.log('6.5 Click on Firing alerts');
    silenceDetailsPage.clickOnFiringAlerts(`${WatchdogAlert.ALERTNAME}`);
    commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
    detailsPage.sectionHeaderShouldExist('Alert details');
    detailsPage.labelShouldExist('alertname=Watchdog');

    cy.log('6.6 Click on Silenced by');
    detailsPage.clickOnSilencedBy(`${WatchdogAlert.ALERTNAME}`);
    commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
    detailsPage.sectionHeaderShouldExist('Silence details');
    detailsPage.labelShouldExist('alertname=Watchdog');

    cy.log('6.7 shows the silenced Alert in the Silenced Alerts list');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Silences');
    silencesListPage.shouldBeLoaded();
    listPage.filter.removeIndividualTag(SilenceState.ACTIVE);
    listPage.filter.removeIndividualTag(SilenceState.PENDING);
    silencesListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    listPage.filter.clickFilter(true, false);
    listPage.filter.selectFilterOption(false, SilenceState.ACTIVE, true);
    silencesListPage.rows.shouldBe(`${WatchdogAlert.ALERTNAME}`, SilenceState.ACTIVE);

    cy.log('6.8 verify on Alerting Rules list page again');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Alerting rules');
    listPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    listPage.ARRows.ARShouldBe(`${WatchdogAlert.ALERTNAME}`);

    cy.log('6.9 verify on Alerts list page again');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    listPage.filter.clearAllFilters();
    listPage.filter.selectFilterOption(true, AlertsAlertState.SILENCED, true);
    listPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    listPage.ARRows.AShouldBe(`${WatchdogAlert.ALERTNAME}`);

    cy.log('6.10 expires the Silence');
    listPage.ARRows.clickAlert();
    detailsPage.clickOnSilencedBy(`${WatchdogAlert.ALERTNAME}`);
    silenceDetailsPage.expireSilence(true, true);


    cy.log('6.11 verify on Alerts list page again');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    listPage.filter.clearAllFilters();
    listPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    listPage.ARRows.AShouldBe(`${WatchdogAlert.ALERTNAME}`);

  });
}
