// Commands ported from openshift/distributed-tracing-console-plugin
// tests/cypress/support/commands.ts (a18f314ec7e2a7fd146ccf86c83f4f3edf552270) for
// cypress/e2e/tracing/coo_tracing.cy.ts.
// `dtLogin` is DT's `login`, renamed because it differs from the monitoring-plugin `login`.
import Loggable = Cypress.Loggable;
import Timeoutable = Cypress.Timeoutable;
import Withinable = Cypress.Withinable;
import Shadow = Cypress.Shadow;
import { tracingGuidedTour } from '../../views/tracing-tour';

export {};
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      // Call sites pass options, but DT's command never forwarded them; kept as is.
      findByTestId(
        selector: string,
        options?: Partial<Loggable & Timeoutable>,
      ): Chainable<JQuery<HTMLElement>>;
      // PatternFly-specific commands
      pfMenuToggle(
        text?: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      pfMenuItem(
        text: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      pfButton(
        text: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      pfEmptyState(
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      pfBreadcrumb(
        text: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      pfTypeahead(
        placeholder?: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      pfSelectMenuItem(
        text: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      pfMenuToggleByLabel(
        ariaLabel: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      pfCheckMenuItem(
        text: string,
        shouldCheck?: boolean,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      muiFirstTraceLink(
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      muiTraceAttribute(
        attributeName: string,
        expectedValue: string | string[] | ((text: string) => boolean),
        isOptional?: boolean,
        logPrefix?: string,
      ): Chainable<void>;
      muiTraceAttributes(
        attributes: {
          [key: string]: {
            value: string | string[] | ((text: string) => boolean);
            optional?: boolean;
          };
        },
        logPrefix?: string,
      ): Chainable<void>;
      pfCloseButtonIfExists(
        ariaLabel?: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<void>;
      menuToggleContains(
        text: string | RegExp,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      verifyTraceCount(
        expectedCount: number | string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<void>;
      // Material-UI specific commands
      muiSelect(
        ariaLabel: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      muiSelectOption(
        optionText: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      // Tracing-specific commands
      setupTracePage(
        tempoInstance: string,
        tenant: string,
        timeframe?: string,
        serviceFilter?: string,
      ): Chainable<void>;
      navigateToTraceDetails(): Chainable<void>;
      dragCutoffResizer(position: number, resizerType?: 'left' | 'right'): Chainable<void>;
      verifyCutoffPosition(expectedWidthPercent: number, tolerance?: number): Chainable<void>;
      // Chainsaw and TLS verification commands
      runChainsawTest(
        testDirs: string | string[],
        description: string,
        options?: { timeout?: number; extraArgs?: string },
      ): Chainable<void>;
      verifyTracesVisible(tempoInstance: string, tenant: string): Chainable<void>;
      dtLogin(provider?: string, username?: string, password?: string): Chainable<Element>;
      dismissWelcomeModal(): Chainable<void>;
    }
  }
}

// Any command added below, must be added to global Cypress interface above

// Simplified login command that handles OAuth redirect properly
Cypress.Commands.add(
  'dtLogin',
  (
    provider: string = Cypress.env('LOGIN_IDP') || 'kube:admin',
    username: string = Cypress.env('LOGIN_USERNAME') || 'kubeadmin',
    password: string = Cypress.env('LOGIN_PASSWORD'),
  ) => {
    cy.session(
      // Prefixed so it never shares a cached session with the monitoring-plugin `login`.
      ['dtLogin', provider, username],
      () => {
        // Check if this is a Hypershift cluster
        cy.exec(
          `oc get node --selector=hypershift.openshift.io/managed --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
          { failOnNonZeroExit: false },
        ).then((result) => {
          const isHypershift =
            result.code === 0 && result.stdout.trim() !== '' && result.stdout.includes('Ready');
          cy.task('log', `Hypershift cluster detected: ${isHypershift}`);

          cy.visit(Cypress.config('baseUrl'));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- console SERVER_FLAGS
          cy.window().then((win: any) => {
            // Check if auth is disabled (for a local development environment)
            if (win.SERVER_FLAGS?.authDisabled) {
              cy.task('log', '  skipping login, console is running with auth disabled');
              return;
            }

            cy.task('log', `  Logging in as ${username}`);

            // Get OAuth URL based on cluster type
            if (isHypershift) {
              // For Hypershift, get OAuth URL from oauthclient
              cy.exec(
                `oc get oauthclient openshift-browser-client -o go-template --template="{{index .redirectURIs 0}}" --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`,
                { failOnNonZeroExit: false },
              ).then((oauthResult) => {
                if (oauthResult.code === 0 && oauthResult.stdout.trim()) {
                  // Trim /oauth/token/display from the end to get the base OAuth URL
                  const oauthOrigin = oauthResult.stdout.trim().replace('/oauth/token/display', '');
                  cy.task('log', `Hypershift OAuth URL: ${oauthOrigin}`);
                  performLogin(oauthOrigin);
                } else {
                  // Fallback to current URL method if OAuth URL detection fails
                  cy.url().then((currentUrl) => {
                    const url = new URL(currentUrl);
                    const oauthOrigin = `${url.protocol}//${url.hostname.replace('console-openshift-console', 'oauth-openshift')}`;
                    cy.task('log', `Fallback OAuth origin: ${oauthOrigin}`);
                    performLogin(oauthOrigin);
                  });
                }
              });
            } else {
              // For regular OpenShift, derive OAuth URL from console URL
              cy.url().then((currentUrl) => {
                const url = new URL(currentUrl);
                const oauthOrigin = `${url.protocol}//${url.hostname.replace('console-openshift-console', 'oauth-openshift')}`;
                cy.task('log', `OAuth origin: ${oauthOrigin}`);
                performLogin(oauthOrigin);
              });
            }
          });

          function performLogin(oauthOrigin) {
            // Use cy.origin to handle the OAuth login on different domain
            cy.origin(
              oauthOrigin,
              { args: { provider, username, password, isHypershift } },
              ({ provider, username, password, isHypershift }) => {
                cy.get('[data-test-id="login"]').should('be.visible');
                cy.get('body').then(($body) => {
                  // For Hypershift clusters, skip provider selection and go directly to login
                  if (!isHypershift && $body.text().includes(provider)) {
                    cy.contains(provider).should('be.visible').click();
                  }
                });
                cy.get('#inputUsername').type(username);
                cy.get('#inputPassword').type(password);
                cy.get('button[type=submit]').click();
              },
            );
          }
        });
      },
      {
        cacheAcrossSpecs: true,
        validate() {
          cy.visit(Cypress.config('baseUrl'));
          // Wait for any OAuth redirects to complete and ensure we're on console domain
          cy.url({ timeout: 30000 }).should('contain', 'console-openshift-console');
          cy.byTestID('username', { timeout: 120000 }).should('be.visible');
          tracingGuidedTour.close();
        },
      },
    );
  },
);

// Dismiss any modal overlay (e.g. OCP 4.22+ "Welcome" modal) if present.
// Polls for up to 10 seconds on first call; subsequent calls do a single quick check.
let welcomeModalSeen = false;
let welcomeModalChecked = false;
Cypress.Commands.add('dismissWelcomeModal', () => {
  const dismissIfPresent = (doc: Document): boolean => {
    const modalCloseBtn = doc.querySelector(
      '.pf-v6-c-modal-box button[aria-label="Close"], .pf-v5-c-modal-box button[aria-label="Close"]',
    );
    if (modalCloseBtn) {
      cy.log('Modal overlay detected, clicking close button');
      cy.wrap(modalCloseBtn).click({ force: true });
      cy.wait(1000);
      welcomeModalSeen = true;
      return true;
    }
    const modalBox = doc.querySelector('.pf-v6-c-modal-box, .pf-v5-c-modal-box');
    if (modalBox) {
      cy.log('Modal overlay detected, clicking first non-Learn button');
      cy.get('.pf-v6-c-modal-box button, .pf-v5-c-modal-box button')
        .not(':contains("Learn")')
        .first()
        .click({ force: true });
      cy.wait(1000);
      welcomeModalSeen = true;
      return true;
    }
    return false;
  };

  if (!welcomeModalChecked) {
    // First time: poll up to 5 times to catch modals that render with delay
    const checkAndDismiss = (attemptsLeft = 5) => {
      cy.wait(2000);
      cy.document().then((doc) => {
        if (dismissIfPresent(doc)) {
          welcomeModalChecked = true;
          return;
        }
        if (attemptsLeft > 0) {
          checkAndDismiss(attemptsLeft - 1);
        } else {
          welcomeModalChecked = true;
        }
      });
    };
    checkAndDismiss();
  } else if (welcomeModalSeen) {
    // Modal was seen before — do a quick single check in case it reappears
    cy.wait(1000);
    cy.document().then((doc) => {
      dismissIfPresent(doc);
    });
  }
});

Cypress.Commands.add('findByTestId', (selector: string) => {
  return cy.get(`[data-testid="${selector}"]`);
});

// PatternFly-specific commands for common component patterns

Cypress.Commands.add(
  'pfMenuToggle',
  (text?: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    const defaultOptions = { timeout: 10000, ...options };
    if (text) {
      cy.get('.pf-v6-c-menu-toggle, .pf-v5-c-menu-toggle', defaultOptions).contains(text);
    } else {
      cy.get('.pf-v6-c-menu-toggle, .pf-v5-c-menu-toggle', defaultOptions);
    }
  },
);

Cypress.Commands.add(
  'pfMenuItem',
  (text: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    const defaultOptions = { timeout: 10000, ...options };
    cy.get('.pf-v6-c-menu__item, .pf-v5-c-menu__item', defaultOptions).contains(text);
  },
);

Cypress.Commands.add(
  'pfButton',
  (text: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    const defaultOptions = { timeout: 10000, ...options };
    cy.contains('.pf-v6-c-button, .pf-v5-c-button', text, defaultOptions);
  },
);

Cypress.Commands.add(
  'pfEmptyState',
  (options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    const defaultOptions = { timeout: 30000, ...options };
    // Wait for page to load completely first
    cy.get('body').should('be.visible');
    // Then look for empty state with extended timeout
    cy.get('.pf-v6-c-empty-state, .pf-v5-c-empty-state', defaultOptions);
  },
);

Cypress.Commands.add(
  'pfBreadcrumb',
  (text: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    const defaultOptions = { timeout: 10000, ...options };
    // Find breadcrumb anchor by text directly
    cy.get('.pf-v6-c-breadcrumb__item a, .pf-v5-c-breadcrumb__item a', defaultOptions).contains(
      text,
    );
  },
);

Cypress.Commands.add(
  'pfTypeahead',
  (placeholder?: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    const defaultOptions = { timeout: 20000, ...options };

    if (placeholder) {
      // Find typeahead by placeholder text
      cy.get('input[placeholder="' + placeholder + '"]', defaultOptions)
        .closest('.pf-v6-c-menu-toggle, .pf-v5-c-menu-toggle')
        .find('.pf-v6-c-menu-toggle__button, .pf-v5-c-menu-toggle__button');
    } else {
      // Find any typeahead toggle button
      cy.get(
        '.pf-v6-c-menu-toggle.pf-m-typeahead .pf-v6-c-menu-toggle__button, .pf-v5-c-menu-toggle.pf-m-typeahead .pf-v5-c-menu-toggle__button',
        defaultOptions,
      );
    }
  },
);

Cypress.Commands.add(
  'pfSelectMenuItem',
  (text: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    const defaultOptions = { timeout: 10000, ...options };
    // Find menu item by text and click its button
    cy.get('.pf-v6-c-menu__item-text, .pf-v5-c-menu__item-text', defaultOptions)
      .contains(text)
      .closest('.pf-v6-c-menu__item, .pf-v5-c-menu__item');
  },
);

Cypress.Commands.add(
  'pfMenuToggleByLabel',
  (ariaLabel: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    const defaultOptions = { timeout: 10000, ...options };
    // Find menu toggle button by aria-label (partial match)
    cy.get(
      `button[aria-label*="${ariaLabel}"], ` +
        `.pf-v6-c-menu-toggle__button[aria-label*="${ariaLabel}"], ` +
        `.pf-v5-c-menu-toggle__button[aria-label*="${ariaLabel}"]`,
      defaultOptions,
    );
  },
);

Cypress.Commands.add(
  'pfCheckMenuItem',
  (
    text: string,
    shouldCheck: boolean = true,
    options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
  ) => {
    const defaultOptions = { timeout: 10000, ...options };
    // Find menu item by text and check/uncheck its checkbox
    cy.contains('.pf-v6-c-menu__item-text, .pf-v5-c-menu__item-text', text, defaultOptions)
      .closest('.pf-v6-c-menu__item, .pf-v5-c-menu__item')
      .find('input[type="checkbox"]')
      .then(($checkbox) => {
        if (shouldCheck) {
          cy.wrap($checkbox).check();
        } else {
          cy.wrap($checkbox).uncheck();
        }
      });
  },
);

Cypress.Commands.add(
  'muiFirstTraceLink',
  (options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    const defaultOptions = { timeout: 10000, ...options };
    // Click the first Material-UI trace link found
    cy.get('a.MuiLink-root', defaultOptions).first();
  },
);

Cypress.Commands.add(
  'muiTraceAttribute',
  (
    attributeName: string,
    expectedValue: string | string[] | ((text: string) => boolean),
    isOptional: boolean = false,
    logPrefix: string = '',
  ) => {
    if (isOptional) {
      // Handle optional attributes with conditional check
      cy.get('body').then(($body) => {
        if ($body.find(`.MuiTypography-h5:contains("${attributeName}")`).length > 0) {
          cy.contains('.MuiTypography-h5', attributeName)
            .next('.MuiTypography-body1')
            .then(($el) => {
              const actualText = $el.text();
              if (logPrefix) {
                cy.log(`Actual text in ${attributeName} (${logPrefix}): ${actualText}`);
              }

              if (typeof expectedValue === 'string') {
                expect(actualText).to.equal(expectedValue);
              } else if (Array.isArray(expectedValue)) {
                expect(expectedValue).to.include(actualText);
              } else if (typeof expectedValue === 'function') {
                expect(actualText).to.satisfy(expectedValue);
              }
            });
        }
      });
    } else {
      // Handle required attributes
      cy.contains('.MuiTypography-h5', attributeName)
        .next('.MuiTypography-body1')
        .then(($el) => {
          const actualText = $el.text();
          if (logPrefix) {
            cy.log(`Actual text in ${attributeName} (${logPrefix}): ${actualText}`);
          }

          if (typeof expectedValue === 'string') {
            cy.wrap($el).should('have.text', expectedValue);
          } else if (Array.isArray(expectedValue)) {
            expect(expectedValue).to.include(actualText);
          } else if (typeof expectedValue === 'function') {
            expect(actualText).to.satisfy(expectedValue);
          }
        });
    }
  },
);

Cypress.Commands.add(
  'muiTraceAttributes',
  (
    attributes: {
      [key: string]: { value: string | string[] | ((text: string) => boolean); optional?: boolean };
    },
    logPrefix: string = '',
  ) => {
    // Check multiple trace attributes in one command
    Object.entries(attributes).forEach(([attributeName, config]) => {
      cy.muiTraceAttribute(attributeName, config.value, config.optional || false, logPrefix);
    });
  },
);

// Material-UI Select commands

Cypress.Commands.add(
  'muiSelect',
  (ariaLabel: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    const defaultOptions = { timeout: 10000, ...options };
    // Find Material-UI Select component by aria-label (supports partial match)
    cy.get(`[role="combobox"][aria-label*="${ariaLabel}"]`, defaultOptions);
  },
);

Cypress.Commands.add(
  'muiSelectOption',
  (optionText: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    const defaultOptions = { timeout: 10000, ...options };
    // Find Material-UI Select option by text in the listbox
    cy.get('[role="listbox"] [role="option"]', defaultOptions).contains(optionText);
  },
);

// Conditional close button command that only clicks if the element exists
Cypress.Commands.add(
  'pfCloseButtonIfExists',
  (ariaLabel?: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    const defaultOptions = { timeout: 10000, ...options };

    const selector = ariaLabel
      ? `button[aria-label="${ariaLabel}"], .pf-v6-c-button[aria-label="${ariaLabel}"], ` +
        `.pf-v5-c-button[aria-label="${ariaLabel}"]`
      : 'button[aria-label*="Close"], button[aria-label*="close"], button[aria-label*="Remove"], .pf-v6-c-button[aria-label*="Close"], .pf-v5-c-button[aria-label*="Close"], .pf-v6-c-button[aria-label*="Remove"], .pf-v5-c-button[aria-label*="Remove"]';

    // Check if element exists and click it if found
    cy.get('body').then(($body) => {
      if ($body.find(selector).length > 0) {
        cy.log(
          `pfCloseButtonIfExists: Found and clicking (${ariaLabel || 'generic close button'})`,
        );
        cy.get(selector, defaultOptions).click();
      } else {
        cy.log(
          `pfCloseButtonIfExists: Element not found (${ariaLabel || 'generic close button'}), skipping`,
        );
      }
    });
  },
);

// Generic command to find and click menu toggle that contains specific text
Cypress.Commands.add(
  'menuToggleContains',
  (text: string | RegExp, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    const defaultOptions = { timeout: 10000, ...options };

    cy.log(`Finding menu toggle containing: ${text}`);

    // Find and click the menu toggle with specified content (PatternFly version agnostic)
    return cy
      .get('.pf-v6-c-menu-toggle, .pf-v5-c-menu-toggle', defaultOptions)
      .contains(text)
      .click();
  },
);

// Simple command to verify trace count in MUI pagination display
Cypress.Commands.add(
  'verifyTraceCount',
  (
    expectedCount: number | string,
    options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
  ) => {
    const defaultOptions = { timeout: 10000, ...options };
    const countStr = expectedCount.toString();

    cy.log(`Verifying trace count is ${countStr}`);

    // Simple direct check - same as the working example
    cy.get('.MuiTablePagination-displayedRows', defaultOptions).should('contain', `of ${countStr}`);

    cy.log(`✓ Verified trace count: ${countStr} traces found`);
  },
);

// Tracing-specific commands for common operations

Cypress.Commands.add(
  'setupTracePage',
  (tempoInstance: string, tenant: string, timeframe?: string, serviceFilter?: string) => {
    cy.log(`Setting up trace page: ${tempoInstance} / ${tenant}`);

    // Navigate to traces page
    cy.reload();
    cy.visit('/observe/traces');
    cy.url().should('include', '/observe/traces');
    cy.dismissWelcomeModal();
    // Wait for the Tempo instance typeahead to confirm the page is fully loaded
    cy.get('input[placeholder="Select a Tempo instance"]', { timeout: 30000 }).should('exist');

    // Select Tempo instance
    cy.pfTypeahead('Select a Tempo instance').click();
    cy.pfSelectMenuItem(tempoInstance).click();

    // Select tenant
    cy.pfTypeahead('Select a tenant').click();
    cy.pfSelectMenuItem(tenant).click();

    // Set timeframe if provided
    if (timeframe) {
      cy.muiSelect('Select time range').click();
      cy.muiSelectOption(timeframe).click();
    }

    // Set service filter if provided
    if (serviceFilter) {
      cy.pfMenuToggle('Service Name').click();
      cy.pfMenuToggleByLabel('Multi typeahead checkbox').click();
      cy.pfCheckMenuItem(serviceFilter);
    }

    cy.log(`✓ Trace page setup complete for ${tempoInstance} / ${tenant}`);
  },
);

Cypress.Commands.add('navigateToTraceDetails', () => {
  cy.log('Navigating to trace details');
  cy.muiFirstTraceLink().click();
  // Wait for trace detail page to fully render span bars before clicking
  cy.findByTestId('span-duration-bar', { timeout: 30000 }).should('have.length.greaterThan', 1);
  cy.findByTestId('span-duration-bar').eq(1).click();
  cy.log('✓ In trace details view');
});

Cypress.Commands.add(
  'dragCutoffResizer',
  (position: number, resizerType: 'left' | 'right' = 'right') => {
    cy.log(`Dragging ${resizerType} resizer to ${position}% position`);

    // Wait for the trace timeline to be fully loaded
    cy.get(`[data-elem="resizer${resizerType === 'right' ? 'Right' : 'Left'}"]`).should(
      'be.visible',
    );

    // Perform the drag operation
    cy.get(`[data-elem="resizer${resizerType === 'right' ? 'Right' : 'Left'}"]`)
      .first()
      .then(($resizer) => {
        const resizerRect = $resizer[0].getBoundingClientRect();

        // Get the timeline container using canvas as a stable reference point
        cy.get('canvas[height="60"]')
          .parent()
          .then(($timeline) => {
            const timelineRect = $timeline[0].getBoundingClientRect();
            const targetX = timelineRect.left + timelineRect.width * (position / 100);

            cy.log(`Timeline bounds: left=${timelineRect.left}, width=${timelineRect.width}`);
            cy.log(
              `Target position: ${position}% = ${targetX}px ` +
                `(timeline left + ${timelineRect.width * (position / 100)}px)`,
            );

            // Drag the resizer to the specified position
            cy.wrap($resizer)
              .trigger('mousedown', { which: 1, force: true })
              .wait(100) // Small delay between mousedown and mousemove
              .trigger('mousemove', {
                clientX: targetX,
                clientY: resizerRect.top + resizerRect.height / 2,
                force: true,
              })
              .wait(100) // Small delay before mouseup
              .trigger('mouseup', { force: true });
          });
      });

    // Wait for the timeline to update after the drag operation
    cy.wait(1000);
    cy.log(`✓ ${resizerType} resizer dragged to ${position}% position`);
  },
);

Cypress.Commands.add(
  'verifyCutoffPosition',
  (expectedWidthPercent: number, tolerance: number = 2) => {
    cy.log(`Verifying cutoff box position is around ${expectedWidthPercent}%`);

    // Verify the cutoff box is positioned correctly
    cy.get('[data-elem="cutoffBox"]')
      .last() // Get the right cutoff box
      .invoke('attr', 'style')
      .then((style) => {
        // Extract the width percentage value
        const widthMatch = style.match(/width:\s*(\d+(?:\.\d+)?)%/);
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- chai assertion
        expect(widthMatch).to.not.be.null;
        const widthValue = parseFloat(widthMatch[1]);

        // Check within tolerance
        const minWidth = expectedWidthPercent - tolerance;
        const maxWidth = expectedWidthPercent + tolerance;
        expect(widthValue).to.be.within(minWidth, maxWidth);

        cy.log(
          `✓ Cutoff box width is ${widthValue}% ` +
            `(within acceptable range of ${minWidth}-${maxWidth}%)`,
        );
      });
  },
);

// Chainsaw and TLS verification commands

Cypress.Commands.add(
  'runChainsawTest',
  (
    testDirs: string | string[],
    description: string,
    options?: { timeout?: number; extraArgs?: string },
  ) => {
    const dirs = Array.isArray(testDirs) ? testDirs : [testDirs];
    const paths = dirs
      .map((d) => (d.startsWith('./') ? d : `./cypress/fixtures/coo/traces/chainsaw/${d}`))
      .join(' ');
    const extraArgs = options?.extraArgs ? ` ${options.extraArgs}` : '';
    const timeout = options?.timeout ?? 600000;

    cy.log(`Run chainsaw test: ${description}`);
    cy.exec(
      'chainsaw test --config ./cypress/fixtures/coo/traces/.chainsaw.yaml ' +
        `--skip-delete ${paths}${extraArgs}`,
      {
        env: { KUBECONFIG: Cypress.env('KUBECONFIG_PATH') },
        timeout,
        failOnNonZeroExit: true,
      },
    ).then((result) => {
      expect(result.code).to.eq(0);
      cy.log(`${description}: ${result.stdout}`);
    });
  },
);

Cypress.Commands.add('verifyTracesVisible', (tempoInstance: string, tenant: string) => {
  cy.log('Verify traces are visible in the UI');

  // After TLS profile changes the plugin pod may have restarted. The web console
  // removes the plugin route until its health polling re-detects the plugin.
  // Reload every 15 s for up to 4 minutes to allow the console to recover.
  const retryIntervalMs = 15000;
  // 4 minutes — console backoff can be long after pod restart; annotation in tls-helpers.sh
  // shortens this in practice
  const maxRetries = 16;

  const retryUntilReady = (attemptsLeft: number) => {
    // Poll the live DOM every 500 ms for up to retryIntervalMs using Cypress.Promise.
    // cy.get('body').then($body => $body.find(...)) takes a static snapshot immediately
    // after page load, before React has mounted plugin components — causing false misses
    // even when the plugin is ready. Active polling catches the element as soon as it
    // appears in the DOM.
    cy.window({ timeout: 20000 })
      .then((win) => {
        return new Cypress.Promise<boolean>((resolve) => {
          const deadline = Date.now() + retryIntervalMs;
          const poll = () => {
            if (win.document.querySelector('input[placeholder="Select a Tempo instance"]')) {
              resolve(true);
            } else if (Date.now() < deadline) {
              setTimeout(poll, 500);
            } else {
              resolve(false);
            }
          };
          poll();
        });
      })
      .then((found) => {
        if (found) {
          cy.log('Plugin is ready');
        } else if (attemptsLeft > 0) {
          cy.log(`Plugin not ready, re-navigating (${attemptsLeft} attempts left)...`);
          cy.visit('/observe/traces');
          cy.url().should('include', '/observe/traces');
          cy.dismissWelcomeModal();
          retryUntilReady(attemptsLeft - 1);
        }
      });
  };

  cy.visit('/observe/traces');
  cy.url().should('include', '/observe/traces');
  cy.dismissWelcomeModal();
  retryUntilReady(maxRetries);

  cy.get('input[placeholder="Select a Tempo instance"]', { timeout: 60000 }).should('exist');
  cy.pfTypeahead('Select a Tempo instance').click();
  cy.pfSelectMenuItem(tempoInstance).click();
  cy.pfTypeahead('Select a tenant').click();
  cy.pfSelectMenuItem(tenant).click();
  cy.muiSelect('Select time range').click();
  cy.muiSelectOption('Last 1 hour').click();
  cy.get('a.MuiLink-root', { timeout: 30000 }).should('be.visible');
  cy.log('PASS: Traces are visible in the UI');
});
