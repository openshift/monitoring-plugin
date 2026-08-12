import { commonPages } from '../../views/shared/common';
import { alertAndSilencesDetailsPage } from '../../views/alerts/alert-and-silence-details-page';
import { alertsListPage } from '../../views/alerts/alerts-list-page';
import { silenceAlertPage } from '../../views/alerts/silence-alert-page';
import { nav } from '../../views/shared/nav';
import { silenceDetailsPage } from '../../views/alerts/silence-details-page';
import { silencesListPage } from '../../views/alerts/silences-list-page';
import { alertingRuleListPage } from '../../views/alerts/alerting-rule-list-page';
import { alertingRuleDetailsPage } from '../../views/alerts/alerting-rule-details-page';
import {
  AlertingRulesAlertState,
  MainTagState,
  Severity,
  SilenceComment,
  SilenceState,
  Source,
  WatchdogAlert,
} from '../../fixtures/shared/cluster-monitoring-operator/constants';
import { FilterOUIAIDs } from '@/shared/constants/data-test';
import type { CustomerPerspective } from '@/shared/constants/perspective';

export function testAlertsRegressionNamespace(perspectiveName: CustomerPerspective) {
  it(`${perspectiveName} perspective - Alerting > Alerts page - Filtering`, () => {
    cy.log('1.1 Header components');
    alertsListPage.filter.selectFilterOption('Alert State', AlertingRulesAlertState.PENDING);
    // Verify Source filter does not exist in namespace view
    cy.byOUIAID('DataViewFilters').find('.pf-v6-c-menu-toggle').first().click();
    cy.get('.pf-v6-c-menu__item').should('not.contain', 'Source');
    cy.byOUIAID('DataViewFilters').find('.pf-v6-c-menu-toggle').first().click();
    alertsListPage.filter.selectFilterOption('Alert State', AlertingRulesAlertState.SILENCED);
    alertsListPage.filter.selectFilterOption('Severity', Severity.CRITICAL);
    alertsListPage.filter.selectFilterOption('Severity', Severity.WARNING);
    alertsListPage.filter.selectFilterOption('Severity', Severity.INFO);
    alertsListPage.filter.selectFilterOption('Severity', Severity.NONE);

    alertsListPage.filter.removeIndividualTag(AlertingRulesAlertState.FIRING);
    alertsListPage.filter.removeIndividualTag(AlertingRulesAlertState.PENDING);
    alertsListPage.filter.removeIndividualTag(AlertingRulesAlertState.SILENCED);
    alertsListPage.filter.clearAllFilters();

    alertsListPage.exportAsCSV(true, /openshift.csv/);

    alertsListPage.filter.byLabel('alertname=' + `${WatchdogAlert.ALERTNAME}`);
    alertsListPage.filter.removeIndividualTag('alertname=' + `${WatchdogAlert.ALERTNAME}`);
    alertsListPage.filter.byLabel('alertname=' + `${WatchdogAlert.ALERTNAME}`);
    alertsListPage.filter.removeIndividualTag('alertname=' + `${WatchdogAlert.ALERTNAME}`);
  });

  it(`${perspectiveName} perspective - Alerting > Silences page > Create silence`, () => {
    cy.log('2.1 use sidebar nav to go to Observe > Alerting');
    nav.tabs.switchTab('Silences');
    silencesListPage.createSilence();
    cy.log(
      'https://issues.redhat.com/browse/OU-1109 - [Namespace-level] - Dev user - Create a silence - namespace label does not have a value',
    );
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher(
      'namespace',
      `${WatchdogAlert.NAMESPACE}`,
      false,
      false,
    );
    silenceAlertPage.assertCommentNoError();
    silenceAlertPage.clickSubmit();
    silenceAlertPage.assertCommentWithError();
    silenceAlertPage.addComment(SilenceComment.SILENCE_COMMENT);
    silenceAlertPage.addCreator('');
    silenceAlertPage.clickSubmit();
    silenceAlertPage.assertCreatorWithError();
  });

  it(
    `${perspectiveName} perspective - ` +
      'Alerting > Alerts / Silences > Kebab icon on List and Details',
    () => {
      cy.log('3.1 use sidebar nav to go to Observe > Alerting');

      cy.log('3.2 filter to Watchdog alert');
      alertsListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
      alertsListPage.ARRows.countShouldBe(1);

      cy.log('3.3 silence alert');
      alertsListPage.ARRows.expandRow();
      alertsListPage.ARRows.silenceAlert();
      silenceAlertPage.addComment(SilenceComment.SILENCE_COMMENT);
      silenceAlertPage.clickSubmit();
      commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);

      cy.log('3.4 Assert Kebab on Alert Details page');
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      commonPages.titleShouldHaveText('Alerting');
      alertsListPage.filter.clearAllFilters();
      alertsListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
      alertsListPage.ARRows.expandRow();
      alertsListPage.ARRows.assertNoKebab();
      alertsListPage.ARRows.clickAlert();
      commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
      alertAndSilencesDetailsPage.assertSilencedAlert();

      cy.log('3.5 Assert Kebab on Silence List page for Silenced alert');
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      nav.tabs.switchTab('Silences');
      silencesListPage.shouldBeLoaded();
      alertsListPage.filter.removeIndividualTag(SilenceState.ACTIVE);
      alertsListPage.filter.removeIndividualTag(SilenceState.PENDING);
      silencesListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
      alertsListPage.filter.selectFilterOption('Silence State', SilenceState.ACTIVE);
      silencesListPage.rows.assertSilencedAlertKebab();

      cy.log('3.6 Click on Silenced alert and Assert Actions button');
      silencesListPage.rows.clickSilencedAlert(`${WatchdogAlert.ALERTNAME}`);
      commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
      silenceDetailsPage.assertActionsSilencedAlert();

      cy.log('3.7 Expire silence');
      silenceDetailsPage.expireSilence(false, true);
      commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      nav.tabs.switchTab('Silences');
      cy.changeNamespace('openshift-monitoring');

      cy.log('3.8 Assert Kebab on Silence List page for Expired alert');
      silencesListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
      silencesListPage.emptyState();
      alertsListPage.filter.removeIndividualTag(SilenceState.ACTIVE);
      alertsListPage.filter.removeIndividualTag(SilenceState.PENDING);
      alertsListPage.filter.selectFilterOption('Silence State', SilenceState.EXPIRED);
      alertsListPage.filter.selectFilterOption('Silence State', SilenceState.ACTIVE);
      alertsListPage.filter.selectFilterOption('Silence State', SilenceState.PENDING);
      silencesListPage.rows.assertExpiredAlertKebab('0');

      cy.log('3.9 Click on Expired alert and Assert Actions button');
      silencesListPage.rows.clickSilencedAlert(`${WatchdogAlert.ALERTNAME}`);
      commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
      silenceDetailsPage.assertActionsExpiredAlert();

      cy.log('3.10 Recreate silence');
      silenceDetailsPage.recreateSilence(false);
      commonPages.titleShouldHaveText('Recreate silence');
      commonPages.projectDropdownShouldNotExist();
      silenceAlertPage.silenceAlertSectionDefault();
      silenceAlertPage.durationSectionDefault();
      silenceAlertPage.alertLabelsSectionDefault();
      silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher(
        'alertname',
        `${WatchdogAlert.ALERTNAME}`,
        false,
        false,
      );
      cy.log(
        'https://issues.redhat.com/browse/OU-1109 - [Namespace-level] - Dev user - Create a silence - namespace label does not have a value',
      );
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
      silenceAlertPage.clickSubmit();
      commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);

      cy.log('3.11 Edit silence');
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      nav.tabs.switchTab('Silences');
      silencesListPage.shouldBeLoaded();
      alertsListPage.filter.removeIndividualTag(SilenceState.PENDING);
      silencesListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
      silencesListPage.rows.editSilence();
      commonPages.titleShouldHaveText('Edit silence');
      commonPages.projectDropdownShouldNotExist();
      silenceAlertPage.silenceAlertSectionDefault();
      silenceAlertPage.editAlertWarning();
      silenceAlertPage.editDurationSectionDefault();
      silenceAlertPage.alertLabelsSectionDefault();
      silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher(
        'alertname',
        `${WatchdogAlert.ALERTNAME}`,
        false,
        false,
      );
      cy.log(
        'https://issues.redhat.com/browse/OU-1109 - [Namespace-level] - Dev user - Create a silence - namespace label does not have a value',
      );
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
      silenceAlertPage.clickSubmit();
      commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);

      cy.log('3.12 Expire silence');
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      nav.tabs.switchTab('Silences');
      silencesListPage.shouldBeLoaded();
      alertsListPage.filter.removeIndividualTag(SilenceState.ACTIVE);
      alertsListPage.filter.removeIndividualTag(SilenceState.PENDING);
      silencesListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
      alertsListPage.filter.selectFilterOption('Silence State', SilenceState.ACTIVE);
      silencesListPage.rows.expireSilence(true);

      cy.log('3.13 Alert Details > Silence alert button > Cancel');
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      alertsListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
      alertsListPage.ARRows.countShouldBe(1);
      alertsListPage.ARRows.expandRow();
      alertsListPage.ARRows.clickAlert();
      commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
      alertAndSilencesDetailsPage.clickSilenceAlertButton();
      silenceAlertPage.addComment(SilenceComment.SILENCE_COMMENT);
      silenceAlertPage.clickCancelButton();
      commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      alertsListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
      alertsListPage.ARRows.countShouldBe(1);
    },
  );

  it(`${perspectiveName} perspective - Alerting > Alerting Rules`, () => {
    cy.log('4.1 use sidebar nav to go to Observe > Alerting');
    nav.tabs.switchTab('Alerting rules');
    alertingRuleListPage.shouldBeLoaded();
    listPage.filter.removeIndividualTag(Source.PLATFORM);

    cy.log('4.2 clear all filters, verify filters and tags');
    alertsListPage.filter.selectFilterOption('Alert State', AlertingRulesAlertState.FIRING);
    alertsListPage.filter.selectFilterOption('Alert State', AlertingRulesAlertState.PENDING);
    alertsListPage.filter.selectFilterOption('Alert State', AlertingRulesAlertState.SILENCED);
    alertsListPage.filter.selectFilterOption('Alert State', AlertingRulesAlertState.NOT_FIRING);
    alertsListPage.filter.selectFilterOption('Severity', Severity.CRITICAL);
    alertsListPage.filter.selectFilterOption('Severity', Severity.WARNING);
    alertsListPage.filter.selectFilterOption('Severity', Severity.INFO);
    alertsListPage.filter.selectFilterOption('Severity', Severity.NONE);
    alertsListPage.filter.selectFilterOption('Source', Source.PLATFORM);
    alertsListPage.filter.selectFilterOption('Source', Source.USER);

    alertsListPage.filter.clickOn1more(MainTagState.ALERT_STATE);
    alertsListPage.filter.clickOn1more(MainTagState.SEVERITY);

    alertsListPage.filter.clickOnShowLess(MainTagState.ALERT_STATE);
    alertsListPage.filter.clickOnShowLess(MainTagState.SEVERITY);

    alertsListPage.filter.clickOn1more(MainTagState.ALERT_STATE);
    alertsListPage.filter.clickOn1more(MainTagState.SEVERITY);

    alertsListPage.filter.removeIndividualTag(AlertingRulesAlertState.FIRING);
    alertsListPage.filter.removeIndividualTag(AlertingRulesAlertState.PENDING);
    alertsListPage.filter.removeIndividualTag(AlertingRulesAlertState.SILENCED);
    alertsListPage.filter.removeIndividualTag(AlertingRulesAlertState.NOT_FIRING);

    alertsListPage.filter.removeIndividualTag(Severity.CRITICAL);
    alertsListPage.filter.removeIndividualTag(Severity.WARNING);
    alertsListPage.filter.removeIndividualTag(Severity.INFO);
    alertsListPage.filter.removeIndividualTag(Severity.NONE);
    alertsListPage.filter.removeIndividualTag(Source.PLATFORM);
    alertsListPage.filter.removeIndividualTag(Source.USER);

    alertingRuleListPage.filter.assertNoClearAllFilters();

    cy.log('4.3 Search by Name');
    alertsListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`, FilterOUIAIDs.RuleNameFilter);
    alertingRuleListPage.countShouldBe(1);
    alertsListPage.filter.clearAllFilters();

    cy.log('4.4 Search by Label');
    alertsListPage.filter.byLabel(`namespace=${WatchdogAlert.NAMESPACE}`);
    alertsListPage.filter.clearAllFilters();

    cy.log('4.5 Search by Name and see details');
    alertsListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`, FilterOUIAIDs.RuleNameFilter);
    alertingRuleListPage.countShouldBe(1);
    alertingRuleListPage.clickAlertingRule(`${WatchdogAlert.ALERTNAME}`);
    alertingRuleDetailsPage.assertAlertingRuleDetailsPage(`${WatchdogAlert.ALERTNAME}`);

    cy.log('4.6 Alerting rule details > Silence alert');
    alertingRuleDetailsPage.clickOnKebabSilenceAlert();
    silenceAlertPage.addComment(SilenceComment.SILENCE_COMMENT);
    silenceAlertPage.clickSubmit();
    commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);

    cy.log('4.7 Alerting rule details > Assert Kebab');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Alerting rules');
    alertsListPage.filter.clearAllFilters();
    alertsListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`, FilterOUIAIDs.RuleNameFilter);
    alertingRuleListPage.clickAlertingRule(`${WatchdogAlert.ALERTNAME}`);
    alertingRuleDetailsPage.assertNoKebab();

    cy.log('4.8 Expire silence');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Silences');
    silencesListPage.shouldBeLoaded();
    alertsListPage.filter.removeIndividualTag(SilenceState.ACTIVE);
    alertsListPage.filter.removeIndividualTag(SilenceState.PENDING);
    silencesListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    alertsListPage.filter.selectFilterOption('Silence State', SilenceState.ACTIVE);
    silencesListPage.rows.expireSilence(true);
  });

  it(`${perspectiveName} perspective - Alerting > Empty state`, () => {
    cy.log('5.1 Empty state');
    cy.changeNamespace('default');
    alertsListPage.emptyState();
    nav.tabs.switchTab('Silences');
    silencesListPage.firstTimeEmptyState();
  });
}
