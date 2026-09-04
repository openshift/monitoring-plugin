import { commonPages } from '../../views/shared/common';
import { alertAndSilencesDetailsPage } from '../../views/alerts/alert-and-silence-details-page';
import { alertsListPage } from '../../views/alerts/alerts-list-page';
import { silenceAlertPage } from '../../views/alerts/silence-alert-page';
import { nav } from '../../views/shared/nav';
import { silenceDetailsPage } from '../../views/alerts/silence-details-page';
import { silencesListPage } from '../../views/alerts/silences-list-page';
import { getValFromElement } from '../../views/shared/utils';
import {
  AlertsAlertState,
  SilenceComment,
  SilenceState,
  WatchdogAlert,
} from '../../fixtures/shared/cluster-monitoring-operator/constants';
import type { CustomerPerspective } from '@/shared/constants/perspective';
import { alertingRuleListPage } from '../../views/alerts/alerting-rule-list-page';

export function testBVTAlerts(perspectiveName: CustomerPerspective) {
  it(
    `${perspectiveName} perspective - ` +
      'Alerting > Alerting Details page > Alerting Rule > Metrics',
    () => {
      cy.log('5.1. use sidebar nav to go to Observe > Alerting');
      commonPages.titleShouldHaveText('Alerting');
      alertsListPage.tabShouldHaveText('Alerts');
      alertsListPage.tabShouldHaveText('Silences');
      alertsListPage.tabShouldHaveText('Alerting rules');
      commonPages.linkShouldExist('Export as CSV');
      commonPages.linkShouldExist('Clear all filters');
      alertsListPage.ARRows.shouldBeLoaded();

      cy.log('5.2. filter Alerts and click on Alert');
      alertsListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
      alertsListPage.ARRows.countShouldBe(1);
      alertsListPage.ARRows.ARShouldBe(
        `${WatchdogAlert.ALERTNAME}`,
        `${WatchdogAlert.SEVERITY}`,
        1,
        'Firing',
      );
      alertsListPage.ARRows.expandRow();
      alertsListPage.ARRows.AShouldBe(
        `${WatchdogAlert.ALERTNAME}`,
        `${WatchdogAlert.SEVERITY}`,
        `${WatchdogAlert.NAMESPACE}`,
      );
      alertsListPage.ARRows.clickAlert();

      cy.log('5.3. click on Alert Details Page');
      commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
      commonPages.detailsPage.common(`${WatchdogAlert.ALERTNAME}`);
      commonPages.detailsPage.alert(`${WatchdogAlert.ALERTNAME}`);

      const timeIntervalValue = getValFromElement(
        `[data-ouia-component-id^="OUIA-Generated-TextInputBase"]`,
      );
      timeIntervalValue.then((value) => {
        expect(value).to.be.a('string');
        expect(String(value).trim()).not.to.equal('');
      });

      cy.log('5.4. click on Alert Rule link');
      alertAndSilencesDetailsPage.clickAlertRule(`${WatchdogAlert.ALERTNAME}`);
      commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
      commonPages.detailsPage.alertRule();
      commonPages.detailsPage.common(`${WatchdogAlert.ALERTNAME}`);
      cy.get(`[class="pf-v6-c-code-block__content"]`)
        .invoke('text')
        .then((expText) => {
          cy.log(`${expText}`);
          cy.wrap(expText).as('alertExpression');
        });

      cy.log('5.5. click on Alert Details Page');
      alertAndSilencesDetailsPage.clickAlertDesc(`${WatchdogAlert.ALERT_DESC}`);
      commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
      commonPages.detailsPage.common(`${WatchdogAlert.ALERTNAME}`);
      commonPages.detailsPage.alert(`${WatchdogAlert.ALERTNAME}`);

      cy.log('5.6. click on Inspect on Alert Details Page');
      alertAndSilencesDetailsPage.clickInspectAlertPage();

      cy.log('5.7. Metrics page is loaded');
      commonPages.titleShouldHaveText('Metrics');

      cy.log('5.8. Assert Expression');
      cy.get('[class="cm-line"]').should('be.visible');
      cy.get(`@alertExpression`).then((expText) => {
        cy.log(`${expText}`);
        cy.get('[class="cm-line"]').invoke('text').should('equal', `${expText}`);
      });
    },
  );

  it(`${perspectiveName} perspective - Creates and expires a Silence`, () => {
    cy.log('6.1 filter to Watchdog alert');
    nav.tabs.switchTab('Alerts');
    alertsListPage.ARRows.shouldBeLoaded();
    alertsListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    alertsListPage.ARRows.countShouldBe(1);

    cy.log('6.2 silence alert');
    alertsListPage.ARRows.expandRow();
    alertsListPage.ARRows.silenceAlert();

    cy.log('6.3 silence alert page');
    commonPages.titleShouldHaveText('Silence alert');

    // Launches create silence form
    silenceAlertPage.silenceAlertSectionDefault();
    silenceAlertPage.durationSectionDefault();
    silenceAlertPage.alertLabelsSectionDefault();
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher(
      'alertname',
      `${WatchdogAlert.ALERTNAME}`,
      false,
      false,
    );
    // silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher(
    //   'severity', `${SEVERITY}`, false, false);
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher(
      'namespace',
      `${WatchdogAlert.NAMESPACE}`,
      false,
      false,
    );
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher(
      'prometheus',
      'openshift-monitoring/k8s',
      false,
      false,
    );

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
    silenceDetailsPage.assertSilenceDetailsPage(
      `${WatchdogAlert.ALERTNAME}`,
      'Silence details',
      'alertname=Watchdog',
    );

    cy.log('6.5 Click on Firing alerts');
    silenceDetailsPage.clickOnFiringAlerts(`${WatchdogAlert.ALERTNAME}`);
    commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
    alertAndSilencesDetailsPage.sectionHeaderShouldExist('Alert details');
    alertAndSilencesDetailsPage.labelShouldExist('alertname=Watchdog');

    cy.log('6.6 Click on Silenced by');
    alertAndSilencesDetailsPage.clickOnSilencedBy(`${WatchdogAlert.ALERTNAME}`);
    commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
    alertAndSilencesDetailsPage.sectionHeaderShouldExist('Silence details');
    alertAndSilencesDetailsPage.labelShouldExist('alertname=Watchdog');

    cy.log('6.7 shows the silenced Alert in the Silenced Alerts list');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Silences');
    silencesListPage.shouldBeLoaded();
    alertsListPage.filter.removeIndividualTag(SilenceState.ACTIVE);
    alertsListPage.filter.removeIndividualTag(SilenceState.PENDING);
    silencesListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    alertsListPage.filter.selectFilterOption('Silence State', SilenceState.ACTIVE);
    silencesListPage.rows.shouldBe(`${WatchdogAlert.ALERTNAME}`, SilenceState.ACTIVE);

    cy.log('6.8 verify on Alerting Rules list page again');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Alerting rules');
    alertingRuleListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    alertingRuleListPage.ARShouldBe(
      `${WatchdogAlert.ALERTNAME}`,
      `${WatchdogAlert.SEVERITY}`,
      1,
      AlertsAlertState.SILENCED,
    );

    cy.log('6.9 verify on Alerts list page again');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    alertsListPage.filter.clearAllFilters();
    alertsListPage.filter.selectFilterOption('Alert State', AlertsAlertState.SILENCED);
    alertsListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    alertsListPage.ARRows.ARShouldBe(
      `${WatchdogAlert.ALERTNAME}`,
      `${WatchdogAlert.SEVERITY}`,
      1,
      AlertsAlertState.SILENCED,
    );

    cy.log('6.10 expires the Silence');
    alertsListPage.ARRows.expandRow();
    alertsListPage.ARRows.clickAlert();
    alertAndSilencesDetailsPage.clickOnSilencedBy(`${WatchdogAlert.ALERTNAME}`);
    silenceDetailsPage.expireSilence(true, true);

    cy.log('6.11 verify on Alerts list page again');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    alertsListPage.filter.clearAllFilters();
    alertsListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    alertsListPage.ARRows.ARShouldBe(
      `${WatchdogAlert.ALERTNAME}`,
      `${WatchdogAlert.SEVERITY}`,
      1,
      AlertsAlertState.FIRING,
    );
  });
}
