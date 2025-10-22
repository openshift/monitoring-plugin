import { commonPages } from '../../../views/common';
import { detailsPage } from '../../../views/details-page';
import { listPage } from '../../../views/list-page';
import { silenceAlertPage } from '../../../views/silence-alert-page';
import { nav } from '../../../views/nav';
import { silenceDetailsPage } from '../../../views/silence-details-page';
import { silencesListPage } from '../../../views/silences-list-page';
import { alertingRuleListPage } from '../../../views/alerting-rule-list-page';
import { alertingRuleDetailsPage } from '../../../views/alerting-rule-details-page';
import { alerts } from '../../../fixtures/monitoring/alert';
import { AlertingRulesAlertState, MainTagState, Severity, SilenceState, Source, SilenceComment, WatchdogAlert } from '../../../fixtures/monitoring/constants';

//
import common = require('mocha/lib/interfaces/common');
// Set constants for the operators that need to be installed for tests.
const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

describe('Regression: Monitoring - Alerts', () => {

  before(() => {
    cy.beforeBlock(MP);
  });

  beforeEach(() => {
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    cy.changeNamespace("All Projects");
  });

  it('1. Admin perspective - Alerting > Alerts page - Filtering', () => {
    cy.log('1.1 Header components');
    
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    alerts.getWatchdogAlert();
    listPage.filter.selectFilterOption(true, AlertingRulesAlertState.PENDING, false);
    listPage.filter.selectFilterOption(false, AlertingRulesAlertState.SILENCED, false);
    listPage.filter.selectFilterOption(false, Severity.CRITICAL, false);
    listPage.filter.selectFilterOption(false, Severity.WARNING, false);
    listPage.filter.selectFilterOption(false, Severity.INFO, false);
    listPage.filter.selectFilterOption(false, Severity.NONE, false);
    listPage.filter.selectFilterOption(false, Source.USER, true);
    listPage.filter.removeMainTag(MainTagState.SOURCE);
    listPage.filter.removeIndividualTag( AlertingRulesAlertState.FIRING);
    listPage.filter.removeIndividualTag( AlertingRulesAlertState.PENDING);
    listPage.filter.removeIndividualTag( AlertingRulesAlertState.SILENCED);
    listPage.filter.clearAllFilters();

    listPage.exportAsCSV(true, /openshift.csv/, `${WatchdogAlert.ALERTNAME}`, `${WatchdogAlert.SEVERITY}`, 'firing', 1);

    listPage.filter.byLabel('alertname='+`${WatchdogAlert.ALERTNAME}`);
    listPage.filter.removeMainTag('Label');
    listPage.filter.byLabel('alertname='+`${WatchdogAlert.ALERTNAME}`);
    listPage.filter.removeIndividualTag('alertname='+`${WatchdogAlert.ALERTNAME}`);

  });

  it('2. Admin perspective - Alerting > Silences page > Create silence', () => {
    cy.log('2.1 use sidebar nav to go to Observe > Alerting');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
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

  it('3. Admin perspective - Alerting > Alerts / Silences > Kebab icon on List and Details', () => {
    cy.visit('/');
    cy.log('3.1 use sidebar nav to go to Observe > Alerting');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    alerts.getWatchdogAlert();
    listPage.ARRows.shouldBeLoaded();

    cy.log('3.2 filter to Watchdog alert');
    listPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    listPage.ARRows.countShouldBe(1);

    cy.log('3.3 silence alert');
    listPage.ARRows.expandRow();
    listPage.ARRows.silenceAlert();
    silenceAlertPage.addComment(SilenceComment.SILENCE_COMMENT);
    silenceAlertPage.clickSubmit();
    commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);

    cy.log('3.4 Assert Kebab on Alert Details page');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    commonPages.titleShouldHaveText('Alerting');
    listPage.filter.clearAllFilters();
    listPage.ARRows.expandRow();
    listPage.ARRows.assertNoKebab();
    listPage.ARRows.clickAlert();
    commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
    detailsPage.assertSilencedAlert();

    cy.log('3.5 Assert Kebab on Silence List page for Silenced alert');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Silences');
    silencesListPage.shouldBeLoaded();
    listPage.filter.removeIndividualTag(SilenceState.ACTIVE);
    listPage.filter.removeIndividualTag(SilenceState.PENDING);
    silencesListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    listPage.filter.clickFilter(true,false);
    listPage.filter.selectFilterOption(false, SilenceState.ACTIVE, true);
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
    silencesListPage.emptyState();
    listPage.filter.removeMainTag(MainTagState.SILENCE_STATE);
    listPage.filter.selectFilterOption(true, SilenceState.EXPIRED, false);
    listPage.filter.selectFilterOption(false, SilenceState.ACTIVE, false);
    listPage.filter.selectFilterOption(false, SilenceState.PENDING, true);
    silencesListPage.rows.assertExpiredAlertKebab('0');

    cy.log('3.9 Click on Expired alert and Assert Actions button');
    silencesListPage.rows.clickSilencedAlert(`${WatchdogAlert.ALERTNAME}`);
    commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
    silenceDetailsPage.assertActionsExpiredAlert();

    cy.log('3.10 Recreate silence');
    silenceDetailsPage.recreateSilence(false);
    commonPages.titleShouldHaveText('Recreate silence');
    silenceAlertPage.silenceAlertSectionDefault();
    silenceAlertPage.durationSectionDefault();
    silenceAlertPage.alertLabelsSectionDefault();
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('alertname', `${WatchdogAlert.ALERTNAME}`, false, false);
    // silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('severity', `${SEVERITY}`, false, false);
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('namespace', `${WatchdogAlert.NAMESPACE}`, false, false);
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('prometheus', 'openshift-monitoring/k8s', false, false);
    silenceAlertPage.clickSubmit();
    commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);

    cy.log('3.11 Edit silence');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Silences');
    silencesListPage.shouldBeLoaded();
    listPage.filter.removeIndividualTag(SilenceState.PENDING);
    silencesListPage.filter.byName( `${WatchdogAlert.ALERTNAME}`);
    silencesListPage.rows.editSilence();
    commonPages.titleShouldHaveText('Edit silence');
    silenceAlertPage.silenceAlertSectionDefault();
    silenceAlertPage.editAlertWarning();
    silenceAlertPage.editDurationSectionDefault();
    silenceAlertPage.alertLabelsSectionDefault();
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('alertname', `${WatchdogAlert.ALERTNAME}`, false, false);
    // silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('severity', `${SEVERITY}`, false, false);
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('namespace', `${WatchdogAlert.NAMESPACE}`, false, false);
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('prometheus', 'openshift-monitoring/k8s', false, false);
    silenceAlertPage.clickSubmit();
    commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);

    cy.log('3.12 Expire silence');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Silences');
    silencesListPage.shouldBeLoaded(); silencesListPage.shouldBeLoaded();
    listPage.filter.removeIndividualTag(SilenceState.ACTIVE);
    listPage.filter.removeIndividualTag(SilenceState.PENDING);
    silencesListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    listPage.filter.clickFilter(true,false);
    listPage.filter.selectFilterOption(false, SilenceState.ACTIVE, true);
    silencesListPage.rows.expireSilence(true);

    cy.log('3.13 Alert Details > Silence alert button > Cancel');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    listPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    listPage.ARRows.countShouldBe(1);
    listPage.ARRows.expandRow();
    listPage.ARRows.clickAlert();
    commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
    detailsPage.clickSilenceAlertButton();
    silenceAlertPage.addComment(SilenceComment.SILENCE_COMMENT);
    silenceAlertPage.clickCancelButton();
    commonPages.titleShouldHaveText(`${WatchdogAlert.ALERTNAME}`);
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    listPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    listPage.ARRows.countShouldBe(1);
  });

  it('4. Admin perspective - Alerting > Alerting Rules', () => {
    cy.log('4.1 use sidebar nav to go to Observe > Alerting');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Alerting rules');
    alertingRuleListPage.shouldBeLoaded();

    cy.log('4.2 clear all filters, verify filters and tags');
    // listPage.filter.clearAllFilters('alerting-rules');
    listPage.filter.selectFilterOption(true, AlertingRulesAlertState.FIRING, false);
    listPage.filter.selectFilterOption(false, AlertingRulesAlertState.PENDING, false);
    listPage.filter.selectFilterOption(false, AlertingRulesAlertState.SILENCED, false);
    listPage.filter.selectFilterOption(false, AlertingRulesAlertState.NOT_FIRING, false);
    listPage.filter.selectFilterOption(false, Severity.CRITICAL, false);
    listPage.filter.selectFilterOption(false, Severity.WARNING, false);
    listPage.filter.selectFilterOption(false, Severity.INFO, false);
    listPage.filter.selectFilterOption(false, Severity.NONE, false);
    listPage.filter.selectFilterOption(false, Source.PLATFORM, false);
    listPage.filter.selectFilterOption(false, Source.USER, true);

    listPage.filter.clickOn1more(MainTagState.ALERT_STATE);
    listPage.filter.clickOn1more(MainTagState.SEVERITY);

    listPage.filter.clickOnShowLess(MainTagState.ALERT_STATE);
    listPage.filter.clickOnShowLess(MainTagState.SEVERITY);

    listPage.filter.removeIndividualTag(AlertingRulesAlertState.FIRING);
    listPage.filter.removeIndividualTag(AlertingRulesAlertState.PENDING);
    listPage.filter.removeIndividualTag(AlertingRulesAlertState.SILENCED);
    listPage.filter.removeIndividualTag(AlertingRulesAlertState.NOT_FIRING);

    listPage.filter.removeMainTag(MainTagState.SEVERITY);
    listPage.filter.removeMainTag(MainTagState.SOURCE);

    alertingRuleListPage.filter.assertNoClearAllFilters();

    cy.log('4.3 Search by Name');
    listPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    alertingRuleListPage.countShouldBe(1);
    listPage.filter.clearAllFilters();

    cy.log('4.4 Search by Label');
    listPage.filter.byLabel(`namespace=${WatchdogAlert.NAMESPACE}`);
    listPage.filter.clearAllFilters();

    cy.log('4.5 Search by Name and see details');
    listPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
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
    listPage.filter.clearAllFilters();
    listPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    alertingRuleListPage.clickAlertingRule(`${WatchdogAlert.ALERTNAME}`);
    alertingRuleDetailsPage.assertNoKebab();

    cy.log('4.8 Expire silence');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Silences');
    silencesListPage.shouldBeLoaded();
    listPage.filter.removeIndividualTag(SilenceState.ACTIVE);
    listPage.filter.removeIndividualTag(SilenceState.PENDING);
    silencesListPage.filter.byName(`${WatchdogAlert.ALERTNAME}`);
    listPage.filter.clickFilter(true,false);
    listPage.filter.selectFilterOption(false, SilenceState.ACTIVE, true);
    silencesListPage.rows.expireSilence(true);

  });

});
