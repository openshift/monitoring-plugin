import { checkErrors } from '../support';
import { commonPages } from '../views/common';
import { detailsPage } from '../views/details-page';
import { listPage } from '../views/list-page';
import { silenceAlertPage } from '../views/silence-alert-page';
import { nav } from '../views/nav';
import { silenceDetailsPage } from '../views/silence-details-page';


const ALERTNAME = 'Watchdog';
const NAMESPACE = 'openshift-monitoring';
const SEVERITY = ' Critical';
const ALERT_DESC = 'This is an alert meant to ensure that the entire alerting pipeline is functional. This alert is always firing, therefore it should always be firing in Alertmanager and always fire against a receiver. There are integrations with various notification mechanisms that send a notification when this alert is not firing. For example the "DeadMansSnitch" integration in PagerDuty.'
const ALERT_SUMMARY = 'An alert that should always be firing to certify that Alertmanager is working properly.'


const shouldBeWatchdogAlertDetailsPage = () => {
  cy.byTestID('resource-title').contains('Watchdog');
  detailsPage.sectionHeaderShouldExist('Alert details');
  detailsPage.labelShouldExist('alertname=Watchdog');
};

const shouldBeWatchdogAlertRulesPage = () => {
  commonPages.titleShouldHaveText('Watchdog');
  detailsPage.sectionHeaderShouldExist('Alerting rule details');
  detailsPage.sectionHeaderShouldExist('Active alerts');
};

const shouldBeWatchdogSilencePage = () => {
  commonPages.titleShouldHaveText('Watchdog');
  detailsPage.sectionHeaderShouldExist('Silence details');
  detailsPage.labelShouldExist('alertname=Watchdog');
};

const SILENCE_ID = '5a11b03f-bfaf-4a4a-9387-40e879458414';
const SILENCE_COMMENT = 'test comment';

function getValFromElement(selector: string) {
  cy.log('Get Val from Element');
  cy.get(selector).should('be.visible'); 
  const elementText = cy.get(selector).invoke('val'); 
  return elementText; 
};

function getTextFromElement(selector: string) {
  cy.log('Get Text from Element');
  cy.get(selector).should('be.visible'); 
  const elementText = cy.get(selector).invoke('text'); 
  return elementText; 
};

describe('Monitoring: Alerts', () => {
  beforeEach(() => {
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
                  namespace: `${NAMESPACE}`,
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

    cy.login('kubeadmin','<password>');

  });

  // afterEach(() => {
  //   checkErrors();
  // });

  it('1. Admin perspective - Observe Menu', () => {
    cy.visit('/');
    cy.log('Admin perspective - Observe Menu and verify all submenus');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      commonPages.titleShouldHaveText('Alerting');
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
      commonPages.titleShouldHaveText('Metrics');
    nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
      commonPages.titleShouldHaveText('Dashboards');
    nav.sidenav.clickNavLink(['Observe', 'Targets']);
      commonPages.cmo_titleShouldHaveText('Metrics targets');
    nav.sidenav.clickNavLink(['Administration', 'Cluster Settings']);
      commonPages.detailsPage.administration_clusterSettings();
    // nav.sidenav.clickNavLink(['Observe', 'Incidents']);
    //   commonPages.titleShouldHaveText('Incidents');
    // nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    //   commonPages.titleShouldHaveText('Dashboards');
  
  })
  //TODO: Intercept Bell GET request to inject an alert (Watchdog to have it opened in Alert Details page?)
  // it('Admin perspective - Bell > Alert details > Alerting rule details > Metrics flow', () => {
  //   cy.visit('/');
  //   commonPages.clickBellIcon();
  //   commonPages.bellIconClickAlert('TargetDown');
  //   commonPages.titleShouldHaveText('TatgetDown')

  // })


  it('2. Admin perspective - Alerting > Alerting Details page > Alerting Rule > Metrics', () => {
    cy.visit('/');
    cy.log('2.1. use sidebar nav to go to Observe > Alerting');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    commonPages.titleShouldHaveText('Alerting');
    commonPages.projectDropdownShouldNotExist();
    listPage.tabShouldHaveText('Alerts');
    listPage.tabShouldHaveText('Silences');
    listPage.tabShouldHaveText('Alerting rules');
    commonPages.linkShouldExist('Export as CSV');
    commonPages.linkShouldExist('Clear all filters');
    listPage.ARRows.shouldBeLoaded();

    cy.log('2.2. filter Alerts and click on Alert');
    listPage.filter.byName('alerts-tab', `${ALERTNAME}`);
    listPage.ARRows.countShouldBe(1);
    listPage.ARRows.ARShouldBe(`${ALERTNAME}`, `${SEVERITY}`, 1, 'Firing');
    listPage.ARRows.expandRow();
    listPage.ARRows.AShouldBe(`${ALERTNAME}`, `${SEVERITY}`, `${NAMESPACE}`);
    listPage.ARRows.clickAlert();

    cy.log('2.3. click on Alert Details Page');
    commonPages.titleShouldHaveText(`${ALERTNAME}`);
    commonPages.detailsPage.common(`${ALERTNAME}`, `${SEVERITY}`);
    commonPages.detailsPage.alert(`${ALERTNAME}`);
    
    const timeIntervalValue = getValFromElement(`[data-ouia-component-id^="OUIA-Generated-TextInputBase"]`);
    timeIntervalValue.then((value) => {
        expect(value).to.not.be.empty;
      })

    cy.log('2.4. click on Alert Rule link');
    detailsPage.clickAlertRule(`${ALERTNAME}`);
    commonPages.titleShouldHaveText(`${ALERTNAME}`);
    commonPages.detailsPage.alertRule;
    commonPages.detailsPage.common(`${ALERTNAME}`, `${SEVERITY}`);
    cy.get(`[class="pf-v6-c-code-block__content"]`).invoke('text').then((expText) => {
      cy.log(`${expText}`);
      cy.wrap(expText).as('alertExpression');
    })

    cy.log('2.5. click on Alert Details Page');
    detailsPage.clickAlertDesc(`${ALERT_DESC}`);
    commonPages.titleShouldHaveText(`${ALERTNAME}`);
    commonPages.detailsPage.common(`${ALERTNAME}`, `${SEVERITY}`);
    commonPages.detailsPage.alert(`${ALERTNAME}`);

    cy.log('2.6. click on Inspect on Alert Details Page');
    detailsPage.clickInspectAlertPage();

    cy.log('2.7. Metrics page is loaded');
    commonPages.titleShouldHaveText('Metrics');

    cy.log('2.8. Assert Expression');
    cy.get('[class="cm-line"]').should('be.visible');
    cy.get(`@alertExpression`).then((expText) => {
      cy.log(`${expText}`);
      cy.get('[class="cm-line"]').invoke('text').should('equal', `${expText}`);
    });
  });

  it('3. Admin perspective - Creates and expires a Silence', () => {
    cy.visit('/');
    // cy.intercept('GET', '/api/alertmanager/api/v2/silences', [
    //   {
    //     id: SILENCE_ID,
    //     status: {
    //       state: 'active',
    //     },
    //     updatedAt: '2023-04-10T12:00:00.123Z',
    //     comment: SILENCE_COMMENT,
    //     createdBy: 'kube:admin',
    //     endsAt: '2023-04-10T14:00:00.123Z',
    //     matchers: [
    //       {
    //         isEqual: true,
    //         isRegex: false,
    //         name: 'alertname',
    //         value: `${ALERTNAME}`,
    //       },
    //       {
    //         isEqual: true,
    //         isRegex: false,
    //         name: 'namespace',
    //         value: `${NAMESPACE}`,
    //       },
    //       {
    //         isEqual: true,
    //         isRegex: false,
    //         name: 'severity',
    //         value: `${SEVERITY}`,
    //       },
    //     ],
    //     startsAt: '2023-04-10T12:00:00.123Z',
    //   },
    // ]).as('getSilences');

    // cy.intercept('POST', '/api/alertmanager/api/v2/silences', { silenceID: SILENCE_ID });

    // cy.intercept('DELETE', '/api/alertmanager/api/v2/silences/*', {});

    cy.log('3.1 use sidebar nav to go to Observe > Alerting');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    listPage.ARRows.shouldBeLoaded();

    cy.log('3.2 filter to Watchdog alert');
    listPage.filter.byName('alerts-tab','Watchdog');
    listPage.ARRows.countShouldBe(1);

    cy.log('3.3 silence alert');
    listPage.ARRows.expandRow();
    listPage.ARRows.silenceAlert();

    cy.log('3.4 silence alert page');
    commonPages.titleShouldHaveText('Silence alert');

    // Launches create silence form
    silenceAlertPage.alertLabelsSectionDefault();
    silenceAlertPage.durationSectionDefault();
    silenceAlertPage.alertLabelsSectionDefault();
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('alertname', `${ALERTNAME}`, false, false);
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('severity', `${SEVERITY}`, false, false);
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
    cy.log('3.5 Assert Silence details page');
    silenceDetailsPage.assertSilenceDetailsPage('Watchdog','Silence details','alertname=Watchdog');
    
    cy.log('3.6 Click on Firing alerts');
    silenceDetailsPage.clickOnFiringAlerts('Watchdog');
    commonPages.titleShouldHaveText('Watchdog');
    detailsPage.sectionHeaderShouldExist('Alert details');
    cy.scrollIntoView();
    detailsPage.labelShouldExist('alertname=Watchdog');

    cy.log('3.7 Click on Silenced by');
    detailsPage.clickOnSilencedBy('Watchdog');
    commonPages.titleShouldHaveText('Watchdog');
    detailsPage.sectionHeaderShouldExist('Silence details');
    detailsPage.labelShouldExist('alertname=Watchdog');

    cy.log('shows the silenced Alert in the Silenced Alerts list');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    

    cy.log('shows the newly created Silence in the Silenced By list');

    cy.log('expires the Silence');
    //cy.byTestID('silence-actions-toggle').click();
    //cy.byTestID('silence-actions').should('contain', 'Expire silence');
    //cy.byTestID('silence-actions')
    //  .contains('Expire silence')
    //  .click();
    //cy.get('button.pf-v5-m-primary').click();
    //cy.get('.pf-v5-c-alert').should('not.exist');
    // Wait for expired silence icon to exist
    //cy.byLegacyTestID('ban-icon').should('exist');
  });
});
