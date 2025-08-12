/* eslint-disable @typescript-eslint/no-use-before-define */
import Loggable = Cypress.Loggable;
import Timeoutable = Cypress.Timeoutable;
import Withinable = Cypress.Withinable;
import Shadow = Cypress.Shadow;
import 'cypress-wait-until';
import { guidedTour } from '../views/tour';
import { nav } from '../views/nav';
import { operatorHubPage } from '../views/operator-hub-page';


const readyTimeoutMilliseconds = Cypress.config('readyTimeoutMilliseconds') as number;
const installTimeoutMilliseconds = Cypress.config('installTimeoutMilliseconds') as number;

export {};
declare global {
    interface Chainable {
    byTestID(
      selector: string,
      options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
    ): Chainable<Element>;
    byTestActionID(selector: string): Chainable<JQuery<HTMLElement>>;
    byLegacyTestID(
      selector: string,
      options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
    ): Chainable<JQuery<HTMLElement>>;
    byButtonText(selector: string): Chainable<JQuery<HTMLElement>>;
    byDataID(selector: string): Chainable<JQuery<HTMLElement>>;
    byTestSelector(
      selector: string,
      options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
    ): Chainable<JQuery<HTMLElement>>;
    byTestDropDownMenu(selector: string): Chainable<JQuery<HTMLElement>>;
    byTestOperatorRow(
      selector: string,
      options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
    ): Chainable<JQuery<HTMLElement>>;
    byTestSectionHeading(selector: string): Chainable<JQuery<HTMLElement>>;
    byTestOperandLink(selector: string): Chainable<JQuery<HTMLElement>>;
    byOUIAID(selector: string): Chainable<Element>;
    byClass(selector: string): Chainable<Element>;
    bySemanticElement(element: string, text?: string): Chainable<JQuery<HTMLElement>>;
    byAriaLabel(label: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>): Chainable<JQuery<HTMLElement>>;
    byPFRole(role: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>): Chainable<JQuery<HTMLElement>>;
  }
}

declare global {
  interface Chainable {
    switchPerspective(perspective: string);
    uiLogin(provider: string, username: string, password: string);
    uiLogout();
    cliLogin(username?, password?, hostapi?);
    cliLogout();
    adminCLI(command: string, options?);
    login(provider?: string, username?: string, password?: string): Chainable<Element>;
    executeAndDelete(command: string);
  }
}

// Any command added below, must be added to global Cypress interface above

Cypress.Commands.add(
  'byTestID',
  (selector: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    cy.get(`[data-test="${selector}"]`, options);
  },
);

Cypress.Commands.add('byTestActionID', (selector: string) =>
  cy.get(`[data-test-action="${selector}"]:not([disabled])`),
);

// Deprecated!  new IDs should use 'data-test', ie. `cy.byTestID(...)`
Cypress.Commands.add(
  'byLegacyTestID',
  (selector: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    cy.get(`[data-test-id="${selector}"]`, options);
  },
);

Cypress.Commands.add('byButtonText', (selector: string) => {
  cy.get('button[type="button"]').contains(`${selector}`);
});

Cypress.Commands.add('byDataID', (selector: string) => {
  cy.get(`[data-id="${selector}"]`);
});

Cypress.Commands.add(
  'byTestSelector',
  (selector: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    cy.get(`[data-test-selector="${selector}"]`, options);
  },
);

Cypress.Commands.add('byTestDropDownMenu', (selector: string) => {
  cy.get(`[data-test-dropdown-menu="${selector}"]`);
});

Cypress.Commands.add('byTestOperatorRow', (selector: string, options?: object) => {
  cy.get(`[data-test-operator-row="${selector}"]`, options);
});

Cypress.Commands.add('byTestSectionHeading', (selector: string) => {
  cy.get(`[data-test-section-heading="${selector}"]`);
});

Cypress.Commands.add('byTestOperandLink', (selector: string) => {
  cy.get(`[data-test-operand-link="${selector}"]`);
});

Cypress.Commands.add('byOUIAID', (selector: string) => cy.get(`[data-ouia-component-id^="${selector}"]`));

Cypress.Commands.add('byClass', (selector: string) => cy.get(`[class="${selector}"]`));

Cypress.Commands.add('bySemanticElement', (element: string, text?: string) => {
  if (text) {
    return cy.get(element).contains(text);
  }
  return cy.get(element);
});

Cypress.Commands.add(
  'byAriaLabel',
  (label: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    return cy.get(`[aria-label="${label}"]`, options);
  }
);

Cypress.Commands.add(
  'byPFRole',
  (role: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    return cy.get(`[role="${role}"]`, options);
  }
);

Cypress.Commands.add(
  'login',
  (
    provider: string = Cypress.env('LOGIN_IDP'),
    username: string = Cypress.env('LOGIN_USERNAME'),
    password: string = Cypress.env('LOGIN_PASSWORD'),
    oauthurl: string,
  ) => {
    cy.session(
      [provider, username],
      () => {
        cy.visit(Cypress.config('baseUrl'));
        cy.log('Session - after visiting');
        cy.window().then(
          (
            win: any, // eslint-disable-line @typescript-eslint/no-explicit-any
          ) => {
            // Check if auth is disabled (for a local development environment)
            if (win.SERVER_FLAGS?.authDisabled) {
              cy.task('log', '  skipping login, console is running with auth disabled');
              return;
            }
            cy.exec(
              `oc get node --selector=hypershift.openshift.io/managed --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
            ).then((result) => {
              cy.log(result.stdout);
              cy.task('log', result.stdout);
              if (result.stdout.includes('Ready')) {
                cy.log(`Attempting login via cy.origin to: ${oauthurl}`);
                cy.task('log', `Attempting login via cy.origin to: ${oauthurl}`);
                cy.origin(
                  oauthurl,
                  { args: { username, password } },
                  ({ username, password }) => {
                    cy.get('#inputUsername').type(username);
                    cy.get('#inputPassword').type(password);
                    cy.get('button[type=submit]').click();
                  },
                );
              } else {
                cy.task('log', `  Logging in as ${username} using fallback on ${oauthurl}`);
                cy.origin(
                  oauthurl,
                  { args: { provider, username, password } },
                  ({ provider, username, password }) => {
                    cy.get('[data-test-id="login"]').should('be.visible');
                    cy.get('body').then(($body) => {
                      if ($body.text().includes(provider)) {
                        cy.contains(provider).should('be.visible').click();
                      }
                    });
                    cy.get('#inputUsername').type(username);
                    cy.get('#inputPassword').type(password);
                    cy.get('button[type=submit]').click();
                  }
                );
              }
            });
          },
        );
      },
      {
        cacheAcrossSpecs: true,
        validate() {
          cy.byTestID("username", {timeout: 120000}).should('be.visible');
          guidedTour.close();
        },
      },
    );
  },
);

const kubeconfig = Cypress.env('KUBECONFIG_PATH');
Cypress.Commands.add('switchPerspective', (perspective: string) => {
  /* If side bar is collapsed then expand it
  before switching perspecting */
  cy.get('body').then((body) => {
    if (body.find('.pf-m-collapsed').length > 0) {
      cy.get('#nav-toggle').click();
    }
  });
  nav.sidenav.switcher.changePerspectiveTo(perspective);
  nav.sidenav.switcher.shouldHaveText(perspective);
});

// To avoid influence from upstream login change
Cypress.Commands.add('uiLogin', (provider: string, username: string, password: string) => {
  cy.log('Commands uiLogin');
  cy.clearCookie('openshift-session-token');
  cy.visit('/');
  cy.window().then(
    (
      win: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    ) => {
      if (win.SERVER_FLAGS?.authDisabled) {
        cy.task('log', 'Skipping login, console is running with auth disabled');
        return;
      }
      cy.get('[data-test-id="login"]').should('be.visible');
      cy.get('body').then(($body) => {
        if ($body.text().includes(provider)) {
          cy.contains(provider).should('be.visible').click();
        } else if ($body.find('li.idp').length > 0) {
          //Using the last idp if doesn't provider idp name
          cy.get('li.idp').last().click();
        }
      });
      cy.get('#inputUsername').type(username);
      cy.get('#inputPassword').type(password);
      cy.get('button[type=submit]').click();
      cy.byTestID('username', { timeout: 120000 }).should('be.visible');
    },
  );
  cy.switchPerspective('Administrator');
});

Cypress.Commands.add('uiLogout', () => {
  cy.window().then(
    (
      win: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    ) => {
      if (win.SERVER_FLAGS?.authDisabled) {
        cy.log('Skipping logout, console is running with auth disabled');
        return;
      }
      cy.log('Log out UI');
      cy.byTestID('username').click();
      cy.byTestID('log-out').should('be.visible');
      cy.byTestID('log-out').click({ force: true });
    },
  );
});

Cypress.Commands.add('cliLogin', (username?, password?, hostapi?) => {
  const loginUsername = username || Cypress.env('LOGIN_USERNAME');
  const loginPassword = password || Cypress.env('LOGIN_PASSWORD');
  const hostapiurl = hostapi || Cypress.env('HOST_API');
  cy.exec(
    `oc login -u ${loginUsername} -p ${loginPassword} ${hostapiurl} --insecure-skip-tls-verify=true`,
    { failOnNonZeroExit: false },
  ).then((result) => {
    cy.log(result.stderr);
    cy.log(result.stdout);
  });
});

Cypress.Commands.add('cliLogout', () => {
  cy.exec(`oc logout`, { failOnNonZeroExit: false }).then((result) => {
    cy.log(result.stderr);
    cy.log(result.stdout);
  });
});

Cypress.Commands.add('adminCLI', (command: string) => {
  cy.log(`Run admin command: ${command}`);
  cy.exec(`${command} --kubeconfig ${kubeconfig}`);
});

Cypress.Commands.add('executeAndDelete', (command: string) => {
  cy.exec(command, { failOnNonZeroExit: false })
    .then(result => {
      if (result.code !== 0) {
        cy.task('logError', `Command "${command}" failed: ${result.stderr || result.stdout}`);
      } else {
        cy.task('log', `Command "${command}" executed successfully`);
      }
    });
});

Cypress.Commands.add('beforeBlock', (MP: { namespace: string, operatorName: string }) => {
  
  cy.log('Before block');
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
        timeout: readyTimeoutMilliseconds,
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
  cy.log('Before block completed');
});

Cypress.Commands.add('afterBlock', (MP: { namespace: string, operatorName: string }) => {
  cy.log('After block');
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
        timeout: readyTimeoutMilliseconds,
        failOnNonZeroExit: true
      }
    ).then((result) => {
      expect(result.code).to.eq(0);
      cy.log(`CMO CSV reverted successfully with Monitoring Plugin image: ${result.stdout}`);
    });
  } else {
    cy.log('MP_IMAGE is NOT set. Skipping reverting the image in CMO operator CSV.');
  }

  cy.log('After block completed');
});

Cypress.Commands.add('beforeBlockCOO', (MCP: { namespace: string, operatorName: string, packageName: string }, MP: { namespace: string, operatorName: string }) => {
  cy.log('Before block COO');
 
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
    cy.get('.co-clusterserviceversion-install__heading', { timeout: installTimeoutMilliseconds }).should(
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
      { timeout: installTimeoutMilliseconds },
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
      { timeout: installTimeoutMilliseconds },
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
        timeout: installTimeoutMilliseconds
      }
    );

  } else {
    throw new Error('No CYPRESS env set for operator installation, check the README for more details.');
  }

  cy.log('Check Cluster Observability Operator status');
  cy.exec(
    `sleep 15 && oc wait --for=condition=Ready pods --selector=app.kubernetes.io/name=observability-operator -n ${MCP.namespace} --timeout=60s --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
    {
      timeout: readyTimeoutMilliseconds,
      failOnNonZeroExit: true
    }
  ).then((result) => {
    expect(result.code).to.eq(0);
    cy.log(`Observability-operator pod is now running in namespace: ${MCP.namespace}`);
  });

  nav.sidenav.clickNavLink(['Ecosystem', 'Installed Operators']);
  cy.byTestID('name-filter-input').should('be.visible').type('Cluster Observability{enter}');
  cy.get('[data-test="status-text"]', { timeout: installTimeoutMilliseconds }).eq(0).should('contain.text', 'Succeeded', { timeout: installTimeoutMilliseconds });

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
        timeout: readyTimeoutMilliseconds,
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
      timeout: readyTimeoutMilliseconds,
      failOnNonZeroExit: true
    }
  ).then((result) => {
    expect(result.code).to.eq(0);
    cy.log(`Monitoring plugin pod is now running in namespace: ${MCP.namespace}`);
  });
  //TODO: https://issues.redhat.com/browse/OCPBUGS-58468 - console reload and logout was happening more often
  // cy.get('.pf-v5-c-alert, .pf-v6-c-alert', { timeout: readyTimeoutMilliseconds })
  //   .contains('Web console update is available')
  //   .then(($alert) => {
  //     // If the alert is found, assert that it exists
  //     expect($alert).to.exist;
  //   }, () => {
  //     // If the alert is not found within the timeout, visit and assert the /monitoring/v2/dashboards page
  //     cy.visit('/monitoring/v2/dashboards');
  //     cy.url().should('include', '/monitoring/v2/dashboards');
  //   });
  cy.reload();
  cy.visit('/monitoring/v2/dashboards');
  cy.url().should('include', '/monitoring/v2/dashboards');

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
        timeout: readyTimeoutMilliseconds,
        failOnNonZeroExit: true
      }
    ).then((result) => {
      expect(result.code).to.eq(0);
      cy.log(`CMO CSV updated successfully with Monitoring Plugin image: ${result.stdout}`);
    });
  } else {
    cy.log('MP_IMAGE is NOT set. Skipping patching the image in CMO operator CSV.');
  }

  cy.log('Before block COO completed');
});

Cypress.Commands.add('afterBlockCOO', (MCP: { namespace: string, operatorName: string, packageName: string }, MP: { namespace: string, operatorName: string }) => {
  cy.log('After block COO');
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

    //TODO: https://issues.redhat.com/browse/OCPBUGS-58468 - console reload and logout was happening more often
    // cy.get('.pf-v5-c-alert, .pf-v6-c-alert', { timeout: 120000 })
    //   .contains('Web console update is available')
    //   .then(($alert) => {
    //     // If the alert is found, assert that it exists
    //     expect($alert).to.exist;
    //   }, () => {
    //     // If the alert is not found within the timeout, visit and assert the /monitoring/v2/dashboards page
    //     cy.visit('/monitoring/v2/dashboards');
    //     cy.url().should('not.include', '/monitoring/v2/dashboards');
    //   });

  }
  cy.log('After block COO completed');
});