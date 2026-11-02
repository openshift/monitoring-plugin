import { commonPages } from '../../views/common';
import { detailsPage } from '../../views/details-page';
import { listPage } from '../../views/list-page';
import { silenceAlertPage } from '../../views/silence-alert-page';
import { nav } from '../../views/nav';
import { silenceDetailsPage } from '../../views/silence-details-page';
import { silencesListPage } from '../../views/silences-list-page';
import { alertingRuleListPage } from '../../views/alerting-rule-list-page';
import { alertingRuleDetailsPage } from '../../views/alerting-rule-details-page';
import {
  AlertingRulesAlertState,
  Cluster,
  MainTagState,
  Severity,
  SilenceComment,
  SilenceState,
  Source,
  WatchdogAlert,
} from '../../fixtures/monitoring/constants';
import { FilterOUIAIDs } from '@/shared/constants/data-test';
import type { CustomerPerspective } from '@/shared/constants/perspective';

export function testAlertsFleetManagementRegression(
  perspectiveName: CustomerPerspective,
  alertName: string = WatchdogAlert.ALERTNAME,
) {
  it(`${perspectiveName} perspective - Alerting > Alerts page - Filtering`, () => {
    cy.log('1.1 Header components');
    listPage.filter.selectFilterOption('Alert State', AlertingRulesAlertState.PENDING);
    listPage.filter.selectFilterOption('Alert State', AlertingRulesAlertState.SILENCED);
    listPage.filter.selectFilterOption('Severity', Severity.CRITICAL);
    listPage.filter.selectFilterOption('Severity', Severity.WARNING);
    listPage.filter.selectFilterOption('Severity', Severity.INFO);
    listPage.filter.selectFilterOption('Severity', Severity.NONE);
    listPage.filter.selectFilterOption('Cluster', Cluster.LOCAL);
    listPage.filter.selectFilterOption('Cluster', Cluster.LOCAL_CLUSTER);
    listPage.filter.selectFilterOption('Cluster', Cluster.SPOKE);
    listPage.filter.removeIndividualTag(Cluster.LOCAL);
    listPage.filter.removeIndividualTag(Cluster.LOCAL_CLUSTER);
    listPage.filter.removeIndividualTag(Cluster.SPOKE);
    listPage.filter.removeIndividualTag(AlertingRulesAlertState.FIRING);
    listPage.filter.removeIndividualTag(AlertingRulesAlertState.PENDING);
    listPage.filter.removeIndividualTag(AlertingRulesAlertState.SILENCED);
    listPage.filter.clearAllFilters();

    listPage.exportAsCSV(true, /openshift.csv/);

    listPage.filter.byLabel('alertname=' + alertName);
    listPage.filter.removeIndividualTag('alertname=' + alertName);
    listPage.filter.byLabel('alertname=' + alertName);
    listPage.filter.removeIndividualTag('alertname=' + alertName);
  });

  it(`${perspectiveName} perspective - Alerting > Alerting Rules page - Filtering`, () => {
    cy.log('2.1 use sidebar nav to go to Observe > Alerting');
    nav.tabs.switchTab('Alerting rules');
    alertingRuleListPage.shouldBeLoaded();

    cy.log('2.2 clear all filters, verify filters and tags');
    listPage.filter.selectFilterOption('Alert State', AlertingRulesAlertState.FIRING);
    listPage.filter.selectFilterOption('Alert State', AlertingRulesAlertState.PENDING);
    listPage.filter.selectFilterOption('Alert State', AlertingRulesAlertState.SILENCED);
    listPage.filter.selectFilterOption('Alert State', AlertingRulesAlertState.NOT_FIRING);
    listPage.filter.selectFilterOption('Severity', Severity.CRITICAL);
    listPage.filter.selectFilterOption('Severity', Severity.WARNING);
    listPage.filter.selectFilterOption('Severity', Severity.INFO);
    listPage.filter.selectFilterOption('Severity', Severity.NONE);
    listPage.filter.selectFilterOption('Source', Source.PLATFORM);
    listPage.filter.selectFilterOption('Source', Source.USER);

    listPage.filter.clickOn1more(MainTagState.ALERT_STATE);
    listPage.filter.clickOn1more(MainTagState.SEVERITY);

    listPage.filter.clickOnShowLess(MainTagState.ALERT_STATE);
    listPage.filter.clickOnShowLess(MainTagState.SEVERITY);

    listPage.filter.clickOn1more(MainTagState.ALERT_STATE);
    listPage.filter.clickOn1more(MainTagState.SEVERITY);

    listPage.filter.removeIndividualTag(AlertingRulesAlertState.FIRING);
    listPage.filter.removeIndividualTag(AlertingRulesAlertState.PENDING);
    listPage.filter.removeIndividualTag(AlertingRulesAlertState.SILENCED);
    listPage.filter.removeIndividualTag(AlertingRulesAlertState.NOT_FIRING);

    listPage.filter.removeIndividualTag(Severity.CRITICAL);
    listPage.filter.removeIndividualTag(Severity.WARNING);
    listPage.filter.removeIndividualTag(Severity.INFO);
    listPage.filter.removeIndividualTag(Severity.NONE);
    listPage.filter.removeIndividualTag(Source.PLATFORM);
    listPage.filter.removeIndividualTag(Source.USER);

    alertingRuleListPage.filter.assertNoClearAllFilters();
  });
}

export function testAlertsCorePlatformHeaderRegression(
  perspectiveName: CustomerPerspective,
  alertName: string = WatchdogAlert.ALERTNAME,
) {
  it(`${perspectiveName} perspective - Alerting > Alerts page - Filtering`, () => {
    cy.log('1.1 Header components');
    listPage.filter.selectFilterOption('Alert State', AlertingRulesAlertState.PENDING);
    listPage.filter.selectFilterOption('Alert State', AlertingRulesAlertState.SILENCED);
    listPage.filter.selectFilterOption('Severity', Severity.CRITICAL);
    listPage.filter.selectFilterOption('Severity', Severity.WARNING);
    listPage.filter.selectFilterOption('Severity', Severity.INFO);
    listPage.filter.selectFilterOption('Severity', Severity.NONE);
    listPage.filter.selectFilterOption('Source', Source.USER);
    listPage.filter.removeIndividualTag(Source.PLATFORM);
    listPage.filter.removeIndividualTag(Source.USER);
    listPage.filter.removeIndividualTag(AlertingRulesAlertState.FIRING);
    listPage.filter.removeIndividualTag(AlertingRulesAlertState.PENDING);
    listPage.filter.removeIndividualTag(AlertingRulesAlertState.SILENCED);
    listPage.filter.clearAllFilters();

    listPage.exportAsCSV(true, /openshift.csv/);

    listPage.filter.byLabel('alertname=' + alertName);
    listPage.filter.removeIndividualTag('alertname=' + alertName);
    listPage.filter.byLabel('alertname=' + alertName);
    listPage.filter.removeIndividualTag('alertname=' + alertName);
  });

  it(`${perspectiveName} perspective - Alerting > Alerting Rules page - Filtering`, () => {
    cy.log('2.1 use sidebar nav to go to Observe > Alerting');
    nav.tabs.switchTab('Alerting rules');
    alertingRuleListPage.shouldBeLoaded();
    listPage.filter.removeIndividualTag(Source.PLATFORM);

    cy.log('2.2 clear all filters, verify filters and tags');
    listPage.filter.selectFilterOption('Alert State', AlertingRulesAlertState.FIRING);
    listPage.filter.selectFilterOption('Alert State', AlertingRulesAlertState.PENDING);
    listPage.filter.selectFilterOption('Alert State', AlertingRulesAlertState.SILENCED);
    listPage.filter.selectFilterOption('Alert State', AlertingRulesAlertState.NOT_FIRING);
    listPage.filter.selectFilterOption('Severity', Severity.CRITICAL);
    listPage.filter.selectFilterOption('Severity', Severity.WARNING);
    listPage.filter.selectFilterOption('Severity', Severity.INFO);
    listPage.filter.selectFilterOption('Severity', Severity.NONE);
    listPage.filter.selectFilterOption('Source', Source.PLATFORM);
    listPage.filter.selectFilterOption('Source', Source.USER);

    listPage.filter.clickOn1more(MainTagState.ALERT_STATE);
    listPage.filter.clickOn1more(MainTagState.SEVERITY);

    listPage.filter.clickOnShowLess(MainTagState.ALERT_STATE);
    listPage.filter.clickOnShowLess(MainTagState.SEVERITY);

    listPage.filter.clickOn1more(MainTagState.ALERT_STATE);
    listPage.filter.clickOn1more(MainTagState.SEVERITY);

    listPage.filter.removeIndividualTag(AlertingRulesAlertState.FIRING);
    listPage.filter.removeIndividualTag(AlertingRulesAlertState.PENDING);
    listPage.filter.removeIndividualTag(AlertingRulesAlertState.SILENCED);
    listPage.filter.removeIndividualTag(AlertingRulesAlertState.NOT_FIRING);

    listPage.filter.removeIndividualTag(Severity.CRITICAL);
    listPage.filter.removeIndividualTag(Severity.WARNING);
    listPage.filter.removeIndividualTag(Severity.INFO);
    listPage.filter.removeIndividualTag(Severity.NONE);
    listPage.filter.removeIndividualTag(Source.PLATFORM);
    listPage.filter.removeIndividualTag(Source.USER);

    alertingRuleListPage.filter.assertNoClearAllFilters();
  });
}

export function testAlertsRegression(
  perspectiveName: CustomerPerspective,
  alertName: string = WatchdogAlert.ALERTNAME,
  alertNamespace: string = WatchdogAlert.NAMESPACE,
) {
  it(`${perspectiveName} perspective - Alerting > Silences page > Create silence`, () => {
    cy.log('3.1 use sidebar nav to go to Observe > Alerting');
    nav.tabs.switchTab('Silences');
    silencesListPage.createSilence();
    silenceAlertPage.assertCommentNoError();
    silenceAlertPage.clickSubmit();
    silenceAlertPage.assertCommentWithError();
    silenceAlertPage.addComment(SilenceComment.SILENCE_COMMENT);
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

  it(
    `${perspectiveName} perspective - ` +
      `Alerting > Alerts / Silences > Kebab icon on List and Details`,
    () => {
      cy.log('4.1 use sidebar nav to go to Observe > Alerting');
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      cy.log('4.2 filter to Watchdog alert');
      listPage.filter.byName(`${alertName}`);
      listPage.ARRows.countShouldBe(1);

      cy.log('4.3 silence alert');
      listPage.ARRows.expandRow();
      listPage.ARRows.silenceAlert();
      silenceAlertPage.addComment(SilenceComment.SILENCE_COMMENT);
      silenceAlertPage.clickSubmit();
      commonPages.titleShouldHaveText(`${alertName}`);

      cy.log('4.4 Assert Kebab on Alert Details page');
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      commonPages.titleShouldHaveText('Alerting');
      listPage.filter.clearAllFilters();
      listPage.filter.byName(`${alertName}`);
      listPage.ARRows.countShouldBe(1);
      listPage.ARRows.expandRow();
      listPage.ARRows.assertNoKebab();
      listPage.ARRows.clickAlert();
      commonPages.titleShouldHaveText(`${alertName}`);
      detailsPage.assertSilencedAlert();

      cy.log('4.5 Assert Kebab on Silence List page for Silenced alert');
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      nav.tabs.switchTab('Silences');
      silencesListPage.shouldBeLoaded();
      listPage.filter.removeIndividualTag(SilenceState.ACTIVE);
      listPage.filter.removeIndividualTag(SilenceState.PENDING);
      silencesListPage.filter.byName(`${alertName}`);
      listPage.filter.selectFilterOption('Silence State', SilenceState.ACTIVE);
      silencesListPage.rows.assertSilencedAlertKebab();

      cy.log('4.6 Click on Silenced alert and Assert Actions button');
      silencesListPage.rows.clickSilencedAlert(`${alertName}`);
      commonPages.titleShouldHaveText(`${alertName}`);
      silenceDetailsPage.assertActionsSilencedAlert();

      cy.log('4.7 Expire silence');
      silenceDetailsPage.expireSilence(false, true);
      commonPages.titleShouldHaveText(`${alertName}`);
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      nav.tabs.switchTab('Silences');

      cy.log('4.8 Assert Kebab on Silence List page for Expired alert');
      silencesListPage.filter.byName(`${alertName}`);
      silencesListPage.emptyState();
      listPage.filter.removeIndividualTag(SilenceState.ACTIVE);
      listPage.filter.removeIndividualTag(SilenceState.PENDING);
      listPage.filter.selectFilterOption('Silence State', SilenceState.EXPIRED);
      listPage.filter.selectFilterOption('Silence State', SilenceState.ACTIVE);
      listPage.filter.selectFilterOption('Silence State', SilenceState.PENDING);
      silencesListPage.rows.assertExpiredAlertKebab('0');

      cy.log('4.9 Click on Expired alert and Assert Actions button');
      silencesListPage.rows.clickSilencedAlert(`${alertName}`);
      commonPages.titleShouldHaveText(`${alertName}`);
      silenceDetailsPage.assertActionsExpiredAlert();

      cy.log('4.10 Recreate silence');
      silenceDetailsPage.recreateSilence(false);
      commonPages.titleShouldHaveText('Recreate silence');
      silenceAlertPage.silenceAlertSectionDefault();
      silenceAlertPage.durationSectionDefault();
      silenceAlertPage.alertLabelsSectionDefault();
      silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher(
        'alertname',
        `${alertName}`,
        false,
        false,
      );
      // silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher(
      //   'severity', `${SEVERITY}`, false, false);
      cy.log(
        'https://issues.redhat.com/browse/OU-1110 - [Namespace-level] - Admin user - Create, Edit, ' +
          'Recreate silences is showing namespace dropdown',
      );
      silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher(
        'namespace',
        `${alertNamespace}`,
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
      commonPages.titleShouldHaveText(`${alertName}`);

      cy.log('4.11 Edit silence');
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      nav.tabs.switchTab('Silences');
      silencesListPage.shouldBeLoaded();
      listPage.filter.removeIndividualTag(SilenceState.PENDING);
      silencesListPage.filter.byName(`${alertName}`);
      silencesListPage.rows.editSilence();
      commonPages.titleShouldHaveText('Edit silence');
      silenceAlertPage.silenceAlertSectionDefault();
      silenceAlertPage.editAlertWarning();
      silenceAlertPage.editDurationSectionDefault();
      silenceAlertPage.alertLabelsSectionDefault();
      silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher(
        'alertname',
        `${alertName}`,
        false,
        false,
      );
      // silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher(
      //   'severity', `${SEVERITY}`, false, false);
      cy.log(
        'https://issues.redhat.com/browse/OU-1110 - [Namespace-level] - Admin user - Create, Edit, ' +
          'Recreate silences is showing namespace dropdown',
      );
      silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher(
        'namespace',
        `${alertNamespace}`,
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
      commonPages.titleShouldHaveText(`${alertName}`);

      cy.log('4.12 Expire silence');
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      nav.tabs.switchTab('Silences');
      silencesListPage.shouldBeLoaded();
      listPage.filter.removeIndividualTag(SilenceState.ACTIVE);
      listPage.filter.removeIndividualTag(SilenceState.PENDING);
      silencesListPage.filter.byName(`${alertName}`);
      listPage.filter.selectFilterOption('Silence State', SilenceState.ACTIVE);
      silencesListPage.rows.expireSilence(true);

      cy.log('4.13 Alert Details > Silence alert button > Cancel');
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      listPage.filter.byName(`${alertName}`);
      listPage.ARRows.countShouldBe(1);
      listPage.ARRows.expandRow();
      listPage.ARRows.clickAlert();
      commonPages.titleShouldHaveText(`${alertName}`);
      detailsPage.clickSilenceAlertButton();
      silenceAlertPage.addComment(SilenceComment.SILENCE_COMMENT);
      silenceAlertPage.clickCancelButton();
      commonPages.titleShouldHaveText(`${alertName}`);
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      listPage.filter.byName(`${alertName}`);
      listPage.ARRows.countShouldBe(1);
    },
  );

  it(`${perspectiveName} perspective - Alerting > Alerting Rules`, () => {
    cy.log('5.1 Search by Name');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Alerting rules');
    listPage.filter.byName(`${alertName}`, FilterOUIAIDs.RuleNameFilter);
    alertingRuleListPage.countShouldBe(1);
    listPage.filter.clearAllFilters();

    cy.log('5.2 Search by Label');
    listPage.filter.byLabel(`namespace=${alertNamespace}`);
    listPage.filter.clearAllFilters();

    cy.log('5.3 Search by Name and see details');
    listPage.filter.byName(`${alertName}`, FilterOUIAIDs.RuleNameFilter);
    alertingRuleListPage.countShouldBe(1);
    alertingRuleListPage.clickAlertingRule(`${alertName}`);
    alertingRuleDetailsPage.assertAlertingRuleDetailsPage(`${alertName}`);

    cy.log('5.4 Alerting rule details > Silence alert');
    alertingRuleDetailsPage.clickOnKebabSilenceAlert();
    silenceAlertPage.addComment(SilenceComment.SILENCE_COMMENT);
    silenceAlertPage.clickSubmit();
    commonPages.titleShouldHaveText(`${alertName}`);

    cy.log('5.5 Alerting rule details > Assert Kebab');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Alerting rules');
    if (perspectiveName !== 'Fleet management') {
      listPage.filter.clearAllFilters();
    }
    listPage.filter.byName(`${alertName}`, FilterOUIAIDs.RuleNameFilter);
    alertingRuleListPage.clickAlertingRule(`${alertName}`);
    alertingRuleDetailsPage.assertNoKebab();

    cy.log('5.6 Expire silence');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Silences');
    silencesListPage.shouldBeLoaded();
    listPage.filter.removeIndividualTag(SilenceState.ACTIVE);
    listPage.filter.removeIndividualTag(SilenceState.PENDING);
    silencesListPage.filter.byName(`${alertName}`);
    listPage.filter.selectFilterOption('Silence State', SilenceState.ACTIVE);
    silencesListPage.rows.expireSilence(true);
  });
}
