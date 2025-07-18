import { checkErrors } from '../support';
import { commonPages } from '../views/common';
import { detailsPage } from '../views/details-page';
import { listPage } from '../views/list-page';
import { silenceAlertPage } from '../views/silence-alert-page';
import { nav } from '../views/nav';
import { silenceDetailsPage } from '../views/silence-details-page';
import { silencesListPage } from '../views/silences-list-page';

//
import { operatorHubPage } from '../views/operator-hub-page';
import { Pages } from '../views/pages';

// Set constants for the operators that need to be installed for tests.
const MCP = {
  namespace: 'openshift-cluster-observability-operator',
  packageName: 'cluster-observability-operator',
  operatorName: 'Cluster Observability Operator',
  config: {
    kind: 'UIPlugin',
    name: 'monitoring',
  },
};

const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

const ALERTNAME = 'Watchdog';
const NAMESPACE = 'openshift-monitoring';
const SEVERITY = 'None';
const ALERT_DESC = 'This is an alert meant to ensure that the entire alerting pipeline is functional. This alert is always firing, therefore it should always be firing in Alertmanager and always fire against a receiver. There are integrations with various notification mechanisms that send a notification when this alert is not firing. For example the "DeadMansSnitch" integration in PagerDuty.'
const ALERT_SUMMARY = 'An alert that should always be firing to certify that Alertmanager is working properly.'

const installTimeout = 600000; //10min
const readyTimeout = 300000; //3min

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

describe('BVT: COO', () => {

  before(() => {

    cy.log('Before all');
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

    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('SKIP_COO_INSTALL is set. Skipping Cluster Observability Operator installation.');
    } else if (Cypress.env('COO_UI_INSTALL')) {
      cy.log('COO_UI_INSTALL is set. COO will be installed from redhat-operators catalog source');
      cy.log('Install Cluster Observability Operator');
      operatorHubPage.installOperator(MCP.packageName, 'redhat-operators');
      cy.get('.co-clusterserviceversion-install__heading', { timeout: installTimeout }).should(
        'include.text',
        'Operator installed successfully',
      );
    } else if (Cypress.env('KONFLUX_COO_BUNDLE_IMAGE')) {
      cy.log('KONFLUX_COO_BUNDLE_IMAGE is set. COO operator will be installed from Konflux bundle.');
      cy.log('Install Cluster Observability Operator');
      cy.exec(
        `oc --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} apply -f ./cypress/fixtures/coo/coo-imagecontentsourcepolicy.yaml`,
      );
      cy.exec(
        `oc create namespace ${MCP.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
      cy.exec(
        `oc label namespaces ${MCP.namespace} openshift.io/cluster-monitoring=true --overwrite=true --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
      cy.exec(
        `operator-sdk run bundle --timeout=10m --namespace ${MCP.namespace} ${Cypress.env('KONFLUX_COO_BUNDLE_IMAGE')} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} --verbose `,
        { timeout: installTimeout },
      );
    } else if (Cypress.env('CUSTOM_COO_BUNDLE_IMAGE')) {
      cy.log('CUSTOM_COO_BUNDLE_IMAGE is set. COO operator will be installed from custom built bundle.');
      cy.log('Install Cluster Observability Operator');
      cy.exec(
        `oc --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} apply -f ./cypress/fixtures/coo/coo-imagecontentsourcepolicy.yaml`,
      );
      cy.exec(
        `oc create namespace ${MCP.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
      cy.exec(
        `oc label namespaces ${MCP.namespace} openshift.io/cluster-monitoring=true --overwrite=true --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
      cy.exec(
        `operator-sdk run bundle --timeout=10m --namespace ${MCP.namespace} ${Cypress.env('CUSTOM_COO_BUNDLE_IMAGE')} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} --verbose `,
        { timeout: installTimeout },
      );
    } else if (Cypress.env('FBC_STAGE_COO_IMAGE')) {
      cy.log('FBC_COO_IMAGE is set. COO operator will be installed from FBC image.');
      cy.log('Install Cluster Observability Operator');
      cy.exec(
        `oc --kubeconfig ${Cypress.env('KUBECONFIG_PATH')} apply -f ./cypress/fixtures/coo/coo-imagecontentsourcepolicy.yaml`,
      );
      cy.exec(
        './cypress/fixtures/coo/coo_stage.sh',
        {
          env: {
            FBC_STAGE_COO_IMAGE: Cypress.env('FBC_STAGE_COO_IMAGE'),
            KUBECONFIG: Cypress.env('KUBECONFIG_PATH'),
          },
          timeout: installTimeout
        }
      );

    } else {
      throw new Error('No CYPRESS env set for operator installation, check the README for more details.');
    }

    cy.log('Check Cluster Observability Operator status');
    cy.exec(
      `sleep 15 && oc wait --for=condition=Ready pods --selector=app.kubernetes.io/name=observability-operator -n ${MCP.namespace} --timeout=60s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      {
        timeout: readyTimeout,
        failOnNonZeroExit: true
      }
    ).then((result) => {
      expect(result.code).to.eq(0);
      cy.log(`Observability-operator pod is now running in namespace: ${MCP.namespace}`);
    });

    nav.sidenav.clickNavLink(['Ecosystem', 'Installed Operators']);
    cy.byTestID('name-filter-input').should('be.visible').type('Cluster Observability{enter}');
    cy.get('[data-test="status-text"]', { timeout: installTimeout }).eq(0).should('contain.text', 'Succeeded', { timeout: installTimeout });

    cy.log('Set Monitoring Console Plugin image in operator CSV');
    if (Cypress.env('MCP_CONSOLE_IMAGE')) {
      cy.log('MCP_CONSOLE_IMAGE is set. the image will be patched in COO operator CSV');
      cy.exec(
        './cypress/fixtures/coo/update-mcp-image.sh',
        {
          env: {
            MCP_CONSOLE_IMAGE: Cypress.env('MCP_CONSOLE_IMAGE'),
            KUBECONFIG: Cypress.env('KUBECONFIG_PATH'),
            MCP_NAMESPACE: `${MCP.namespace}`
          },
          timeout: readyTimeout,
          failOnNonZeroExit: true
        }
      ).then((result) => {
        expect(result.code).to.eq(0);
        cy.log(`COO CSV updated successfully with Monitoring Console Plugin image: ${result.stdout}`);
      });
    } else {
      cy.log('MCP_CONSOLE_IMAGE is NOT set. Skipping patching the image in COO operator CSV.');
    }

    cy.log('Create PersesDashboard instance.');
    cy.exec(`oc apply -f ./cypress/fixtures/coo/openshift-cluster-sample-dashboard.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.log('Create Thanos Querier instance.');
    cy.exec(`oc apply -f ./cypress/fixtures/coo/thanos-querier-datasource.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

    cy.log('Create Monitoring UI Plugin instance.');
    cy.exec(`oc apply -f ./cypress/fixtures/coo/monitoring-ui-plugin.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);
    cy.exec(
      `sleep 15 && oc wait --for=condition=Ready pods --selector=app.kubernetes.io/instance=monitoring -n ${MCP.namespace} --timeout=60s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      {
        timeout: readyTimeout,
        failOnNonZeroExit: true
      }
    ).then((result) => {
      expect(result.code).to.eq(0);
      cy.log(`Monitoring plugin pod is now running in namespace: ${MCP.namespace}`);
    });
    cy.get('.pf-v5-c-alert, .pf-v6-c-alert', { timeout: readyTimeout })
      .contains('Web console update is available')
      .then(($alert) => {
        // If the alert is found, assert that it exists
        expect($alert).to.exist;
      }, () => {
        // If the alert is not found within the timeout, visit and assert the /monitoring/v2/dashboards page
        cy.visit('/monitoring/v2/dashboards');
        cy.url().should('include', '/monitoring/v2/dashboards');
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

  });


  after(() => {
    if (Cypress.env('SKIP_COO_INSTALL')) {
      cy.log('Delete Monitoring UI Plugin instance.');
      cy.executeAndDelete(
        `oc delete ${MCP.config.kind} ${MCP.config.name} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log('Remove cluster-admin role from user.');
      cy.executeAndDelete(
        `oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );
    } else {
      cy.log('Delete Monitoring UI Plugin instance.');
      cy.executeAndDelete(
        `oc delete ${MCP.config.kind} ${MCP.config.name} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.log('Remove Cluster Observability Operator');
      cy.executeAndDelete(`oc delete namespace ${MCP.namespace} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);

      cy.log('Remove cluster-admin role from user.');
      cy.executeAndDelete(
        `oc adm policy remove-cluster-role-from-user cluster-admin ${Cypress.env('LOGIN_USERNAME')} --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
      );

      cy.get('.pf-v5-c-alert, .pf-v6-c-alert', { timeout: 120000 })
        .contains('Web console update is available')
        .then(($alert) => {
          // If the alert is found, assert that it exists
          expect($alert).to.exist;
        }, () => {
          // If the alert is not found within the timeout, visit and assert the /monitoring/v2/dashboards page
          cy.visit('/monitoring/v2/dashboards');
          cy.url().should('not.include', '/monitoring/v2/dashboards');
        });
    }
  });

  it('1. Admin perspective - Observe Menu', () => {
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
    // commonPages.titleShouldHaveText('Incidents');
    nav.sidenav.clickNavLink(['Observe', 'Dashboards (Perses)']);
    commonPages.titleShouldHaveText('Dashboards');



  });
  //TODO: Intercept Bell GET request to inject an alert (Watchdog to have it opened in Alert Details page?)
  // it('Admin perspective - Bell > Alert details > Alerting rule details > Metrics flow', () => {
  //   cy.visit('/');
  //   commonPages.clickBellIcon();
  //   commonPages.bellIconClickAlert('TargetDown');
  //   commonPages.titleShouldHaveText('TatgetDown')

  // })


  it('2. Admin perspective - Alerting > Alerting Details page > Alerting Rule > Metrics', () => {
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
    });

    cy.log('2.4. click on Alert Rule link');
    detailsPage.clickAlertRule(`${ALERTNAME}`);
    commonPages.titleShouldHaveText(`${ALERTNAME}`);
    commonPages.detailsPage.alertRule;
    commonPages.detailsPage.common(`${ALERTNAME}`, `${SEVERITY}`);
    cy.get(`[class="pf-v6-c-code-block__content"]`).invoke('text').then((expText) => {
      cy.log(`${expText}`);
      cy.wrap(expText).as('alertExpression');
    });

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

    cy.log('3.4 silence alert page');
    commonPages.titleShouldHaveText('Silence alert');

    // Launches create silence form
    silenceAlertPage.alertLabelsSectionDefault();
    silenceAlertPage.durationSectionDefault();
    silenceAlertPage.alertLabelsSectionDefault();
    silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('alertname', `${ALERTNAME}`, false, false);
    // silenceAlertPage.assertLabelNameLabelValueRegExNegMatcher('severity', `${SEVERITY}`, false, false);
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
    silenceDetailsPage.assertSilenceDetailsPage(`${ALERTNAME}`, 'Silence details', 'alertname=Watchdog');

    cy.log('3.6 Click on Firing alerts');
    silenceDetailsPage.clickOnFiringAlerts(`${ALERTNAME}`);
    commonPages.titleShouldHaveText(`${ALERTNAME}`);
    detailsPage.sectionHeaderShouldExist('Alert details');
    detailsPage.labelShouldExist('alertname=Watchdog');

    cy.log('3.7 Click on Silenced by');
    detailsPage.clickOnSilencedBy(`${ALERTNAME}`);
    commonPages.titleShouldHaveText(`${ALERTNAME}`);
    detailsPage.sectionHeaderShouldExist('Silence details');
    detailsPage.labelShouldExist('alertname=Watchdog');

    cy.log('3.8 shows the silenced Alert in the Silenced Alerts list');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    nav.tabs.switchTab('Silences');
    silencesListPage.shouldBeLoaded();
    listPage.filter.clearAllFilters('silences');
    listPage.filter.byName('silences', `${ALERTNAME}`);
    silencesListPage.rows.SShouldBe(`${ALERTNAME}`, 'Active');

    cy.log('3.9 verify on Alerts list page again');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    listPage.filter.clearAllFilters('alerts-tab');
    listPage.filter.selectFilterOption(true, 'Silenced', true);
    listPage.filter.byName('alerts-tab', `${ALERTNAME}`);
    listPage.ARRows.ARShouldBe(`${ALERTNAME}`, `${SEVERITY}`, 1, 'Silenced');

    cy.log('3.10 expires the Silence');
    listPage.ARRows.expandRow();
    listPage.ARRows.assertNoKebab();
    listPage.ARRows.clickAlert();
    detailsPage.assertSilencedByKebab();
    detailsPage.expireSilence(true);

    cy.log('3.11 verify on Alerts list page again');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    listPage.filter.clearAllFilters('alerts-tab');
    listPage.filter.byName('alerts-tab', `${ALERTNAME}`);
    listPage.ARRows.ARShouldBe(`${ALERTNAME}`, `${SEVERITY}`, 1, 'Firing');

  });

});
