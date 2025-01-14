import { checkErrors } from '../support';
import { projectDropdown } from '../views/common';
import { detailsPage } from '../views/details-page';
import { listPage } from '../views/list-page';
import { nav } from '../views/nav';

const shouldBeWatchdogAlertDetailsPage = () => {
  cy.byTestID('resource-title').contains('Watchdog');
  detailsPage.sectionHeaderShouldExist('Alert details');
  detailsPage.labelShouldExist('alertname=Watchdog');
};

const shouldBeWatchdogAlertRulesPage = () => {
  cy.byTestID('resource-title').contains('Watchdog');
  detailsPage.sectionHeaderShouldExist('Alerting rule details');
  detailsPage.sectionHeaderShouldExist('Active alerts');
};

const shouldBeWatchdogSilencePage = () => {
  cy.byTestID('resource-title').contains('Watchdog');
  detailsPage.sectionHeaderShouldExist('Silence details');
  detailsPage.labelShouldExist('alertname=Watchdog');
};

const SILENCE_ID = '5a11b03f-bfaf-4a4a-9387-40e879458414';
const SILENCE_COMMENT = 'test comment';

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
                name: 'Watchdog',
                query: 'vector(1)',
                duration: 0,
                labels: {
                  namespace: 'openshift-monitoring',
                  prometheus: 'openshift-monitoring/k8s',
                  severity: 'none',
                },
                annotations: {
                  description:
                    'This is an alert meant to ensure that the entire alerting pipeline is functional.\nThis alert is always firing, therefore it should always be firing in Alertmanager\nand always fire against a receiver. There are integrations with various notification\nmechanisms that send a notification when this alert is not firing. For example the\n"DeadMansSnitch" integration in PagerDuty.\n',
                  summary:
                    'An alert that should always be firing to certify that Alertmanager is working properly.',
                },
                alerts: [
                  {
                    labels: {
                      alertname: 'Watchdog',
                      namespace: 'openshift-monitoring',
                      severity: 'none',
                    },
                    annotations: {
                      description:
                        'This is an alert meant to ensure that the entire alerting pipeline is functional.\nThis alert is always firing, therefore it should always be firing in Alertmanager\nand always fire against a receiver. There are integrations with various notification\nmechanisms that send a notification when this alert is not firing. For example the\n"DeadMansSnitch" integration in PagerDuty.\n',
                      summary:
                        'An alert that should always be firing to certify that Alertmanager is working properly.',
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

    cy.visit('/');
  });

  afterEach(() => {
    checkErrors();
  });

  it('displays and filters the Alerts list page, links to detail pages', () => {
    cy.log('use sidebar nav to go to Observe > Alerting');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    // TODO, switch to 'listPage.titleShouldHaveText('Alerting');', when we switch to new test id
    cy.byLegacyTestID('resource-title').should('have.text', 'Alerting');
    projectDropdown.shouldNotExist();
    listPage.rows.shouldBeLoaded();

    cy.log('filter Alerts');
    listPage.filter.byName('Watchdog');
    listPage.rows.countShouldBe(1);

    // TODO: Alert details page fails to load in Cypress, so disable the following tests for now
    // cy.log('drills down to Alert details page');
    // listPage.rows.shouldExist('Watchdog').click();
    // shouldBeWatchdogAlertDetailsPage();

    //cy.log('drill down to the Alerting rule details page');
    //cy.byTestID('alert-rules-detail-resource-link')
    //  .contains('Watchdog')
    //  .click();
    //shouldBeWatchdogAlertRulesPage();

    // Active alerts list should contain a link back to the Alert details page
    //cy.log('drill back up to the Alert details page');
    //cy.byTestID('active-alerts')
    //  .first()
    //  .click();
    //shouldBeWatchdogAlertDetailsPage();
  });

  it('creates and expires a Silence', () => {
    cy.intercept('GET', '/api/alertmanager/api/v2/silences', [
      {
        id: SILENCE_ID,
        status: {
          state: 'active',
        },
        updatedAt: '2023-04-10T12:00:00.123Z',
        comment: SILENCE_COMMENT,
        createdBy: 'kube:admin',
        endsAt: '2023-04-10T14:00:00.123Z',
        matchers: [
          {
            isEqual: true,
            isRegex: false,
            name: 'alertname',
            value: 'Watchdog',
          },
          {
            isEqual: true,
            isRegex: false,
            name: 'namespace',
            value: 'openshift-monitoring',
          },
          {
            isEqual: true,
            isRegex: false,
            name: 'severity',
            value: 'none',
          },
        ],
        startsAt: '2023-04-10T12:00:00.123Z',
      },
    ]).as('getSilences');

    cy.intercept('POST', '/api/alertmanager/api/v2/silences', { silenceID: SILENCE_ID });

    cy.intercept('DELETE', '/api/alertmanager/api/v2/silences/*', {});

    cy.log('use sidebar nav to go to Observe > Alerting');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    listPage.rows.shouldBeLoaded();

    cy.log('filter to Watchdog alert');
    listPage.filter.byName('Watchdog');
    listPage.rows.countShouldBe(1);
    // TODO: Alert details page fails to load in Cypress, so disable the following tests for now
    // listPage.rows.shouldExist('Watchdog').click();
    // shouldBeWatchdogAlertDetailsPage();

    // detailsPage.clickPageActionButton('Silence alert');
    cy.visit(
      '/monitoring/silences/~new?alertname=Watchdog&namespace=openshift-monitoring&severity=none',
    );

    // Launches create silence form
    cy.log('silence Watchdog alert');
    cy.byTestID('silence-start-immediately').should('be.checked');
    cy.byTestID('silence-from').should('have.value', 'Now');
    cy.byTestID('silence-for').should('contain', '2h');
    cy.byTestID('silence-until').should('have.value', '2h from now');
    // Change duration
    cy.byTestID('silence-for-toggle').click();
    cy.byTestID('silence-for').should('contain', '1h');
    cy.byTestID('silence-for').contains(/^1h$/).click();
    cy.byTestID('silence-until').should('have.value', '1h from now');
    // Change to not start now
    cy.byTestID('silence-start-immediately').click();
    cy.byTestID('silence-start-immediately').should('not.be.checked');
    // Allow for some difference in times
    cy.byTestID('silence-from').should('not.have.value', 'Now');
    cy.byTestID('silence-from').then(($fromElement) => {
      const fromText = $fromElement[0].getAttribute('value');
      expect(Date.parse(fromText) - Date.now()).to.be.lessThan(10000);
      // eslint-disable-next-line promise/no-nesting
      cy.byTestID('silence-until').then(($untilElement) => {
        expect(Date.parse($untilElement[0].getAttribute('value')) - Date.parse(fromText)).to.equal(
          60 * 60 * 1000,
        );
      });
    });
    // Invalid start time
    cy.byTestID('silence-from').type('abc');
    cy.byTestID('silence-until').should('have.value', '-');
    // Change to back to start now
    cy.byTestID('silence-start-immediately').click();
    cy.byTestID('silence-start-immediately').should('be.checked');
    cy.byTestID('silence-until').should('have.value', '1h from now');
    // Change duration back again
    cy.byTestID('silence-for-toggle').click();
    cy.byTestID('silence-for').should('contain', '2h');
    cy.byTestID('silence-for').contains(/^2h$/).click();
    cy.byTestID('silence-until').should('have.value', '2h from now');
    // Add comment and submit
    cy.byTestID('silence-comment').type(SILENCE_COMMENT);
    cy.get('button[type=submit]').click();
    cy.get('.pf-v5-c-alert').should('not.exist');

    // After creating the Silence, should be redirected to its details page
    shouldBeWatchdogSilencePage();
    cy.log('shows the silenced Alert in the Silenced Alerts list');
    // Click the link to navigate back to the Alert details link
    //cy.byTestID('firing-alerts')
    //  .first()
    //  .should('have.text', 'Watchdog')
    //  .click();
    // shouldBeWatchdogAlertDetailsPage();

    // Click the link to navigate back to the Silence details page
    //cy.log('shows the newly created Silence in the Silenced By list');
    //cy.byLegacyTestID('silence-resource-link')
    //  .first()
    //  .should('have.text', 'Watchdog')
    //  .click();
    //shouldBeWatchdogSilencePage();

    //cy.log('expires the Silence');
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
