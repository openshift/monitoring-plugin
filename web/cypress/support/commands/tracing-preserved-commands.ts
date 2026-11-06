// Preserved from distributed-tracing-console-plugin a18f314, including currently unused helpers.
// Keep tracing's perspective implementation separate from monitoring-plugin's command.
import Loggable = Cypress.Loggable;
import Timeoutable = Cypress.Timeoutable;
import Withinable = Cypress.Withinable;
import Shadow = Cypress.Shadow;

export {};
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      byCy(
        selector: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      byRole(
        role: string,
        name?: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      byText(
        text: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      byLabelText(
        text: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      pfToolbarItem(
        index?: number,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      muiTraceLink(
        serviceName: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      muiSpanBar(
        serviceName: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      muiFirstSpanBar(
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      pfCloseButton(
        ariaLabel?: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
      ): Chainable<JQuery<HTMLElement>>;
      dtSwitchPerspective(perspective: string): Chainable<Element>;
      uiLogin(provider: string, username: string, password: string): Chainable<Element>;
      uiLogout(): Chainable<Element>;
      cliLogin(username?: string, password?: string, hostapi?: string): Chainable<Element>;
      cliLogout(): Chainable<Element>;
      interceptFeedback(
        alias: string,
        conversationId: string,
        sentiment: number,
        userFeedback: string,
        userQuestionStartsWith: string,
      ): Chainable<Element>;
      interceptQuery(
        alias: string,
        query: string,
        conversationId?: string | null,
        attachments?: Array<{ attachment_type: string; content_type: string }>,
      ): Chainable<Element>;
      interceptQueryWithError(
        alias: string,
        query: string,
        errorMessage: string,
      ): Chainable<Element>;
    }
  }
}

const OLS_API_BASE_URL = '/api/proxy/plugin/lightspeed-console-plugin/ols';
const getOlsApiUrl = (path: string): string => `${OLS_API_BASE_URL}${path}`;

const MOCK_STREAM_START =
  'data: {"event": "start", "data": {"conversation_id": "5f424596-a4f9-4a3a-932b-46a768de3e7c"}}';
const MOCK_TOOL_RESULT =
  'data: {"event": "tool_result", "data": {"id": 123,  "content": "Tool response", "status": "success"}}';
const MOCK_STREAMED_RESPONSE_BODY = `${MOCK_STREAM_START}

data: {"event": "token", "data": {"id": 0, "token": "Mock"}}

data: {"event": "token", "data": {"id": 1, "token": " OLS"}}

data: {"event": "token", "data": {"id": 2, "token": " response"}}

data: {"event": "end", "data": {"referenced_documents": [], "truncated": false}}
`;

type OlsAttachment = { attachment_type: string; content_type: string };

const MOCK_STREAMED_RESPONSE_WITH_ERROR_BODY = `${MOCK_STREAM_START}

data: {"event": "token", "data": {"id": 0, "token": "Partial"}}

data: {"event": "token", "data": {"id": 1, "token": " response"}}

data: {"event": "tool_call", "data": {"id": 123, "name": "ABC", "args": {"some_key": "some_value"}}}

${MOCK_TOOL_RESULT}

data: {"event": "error", "data": "MOCK_ERROR_MESSAGE"}
`;

const USER_FEEDBACK_MOCK_RESPONSE = { body: { message: 'Feedback received' } };

Cypress.Commands.add('dtSwitchPerspective', (perspective: string) => {
  /* If side bar is collapsed then expand it
  before switching perspecting */
  cy.get('body').then((body) => {
    if (body.find('.pf-m-collapsed').length > 0) {
      cy.get('#nav-toggle').click();
    }
  });
  // Note: nav object would need to be imported or defined elsewhere
  // For now, using direct DOM selectors
  cy.get('[data-test="perspective-switcher-toggle"]').click();
  cy.contains('[data-test="perspective-switcher-menu-option"]', perspective).click();
});

Cypress.Commands.add('uiLogin', (provider: string, username: string, password: string) => {
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
  cy.dtSwitchPerspective('Administrator');
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
      cy.byTestID('user-dropdown').click();
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
    `oc login -u ${loginUsername} -p ${loginPassword} ${hostapiurl}` +
      ' --insecure-skip-tls-verify=true',
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

Cypress.Commands.add(
  'byCy',
  (selector: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    cy.get(`[data-cy="${selector}"]`, options);
  },
);

Cypress.Commands.add(
  'byRole',
  (
    role: string,
    name?: string,
    options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
  ) => {
    const selector = name
      ? `[role="${role}"][aria-label="${name}"], [role="${role}"][aria-labelledby*="${name}"]`
      : `[role="${role}"]`;
    cy.get(selector, options);
  },
);

Cypress.Commands.add(
  'byText',
  (text: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    cy.contains(text, options);
  },
);

Cypress.Commands.add(
  'byLabelText',
  (text: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    // Find form elements by their associated label - with error handling
    cy.get('body').then(($body) => {
      if ($body.find(`label:contains("${text}")`).length > 0) {
        cy.get(`label:contains("${text}")`, options).then(($label) => {
          const forAttr = $label.attr('for');
          if (forAttr) {
            cy.get(`#${forAttr}`, options);
          } else {
            cy.wrap($label).find('input, select, textarea', options);
          }
        });
      } else {
        cy.log(`Label with text "${text}" not found`);
      }
    });
  },
);

Cypress.Commands.add(
  'pfToolbarItem',
  (index?: number, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    const selector = '.pf-v6-c-toolbar__item, .pf-v5-c-toolbar__item';
    const defaultOptions = { timeout: 10000, ...options };
    if (typeof index === 'number') {
      cy.get(selector, defaultOptions).eq(index);
    } else {
      cy.get(selector, defaultOptions);
    }
  },
);

Cypress.Commands.add(
  'muiTraceLink',
  (serviceName: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    const defaultOptions = { timeout: 10000, ...options };
    // Find Material-UI trace link by service name
    cy.contains('a.MuiLink-root', serviceName, defaultOptions);
  },
);

Cypress.Commands.add(
  'muiSpanBar',
  (serviceName: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    const defaultOptions = { timeout: 10000, ...options };
    // Find span by service name and return the container with duration bar
    cy.contains('strong', serviceName, defaultOptions).closest('.MuiStack-root');
  },
);

Cypress.Commands.add(
  'muiFirstSpanBar',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- source ignores options
  (_options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    // Preserve the source behavior: options were accepted but never forwarded.
    // Click the first span duration bar found
    cy.findByTestId('span-duration-bar').first();
  },
);

Cypress.Commands.add(
  'pfCloseButton',
  (ariaLabel?: string, options?: Partial<Loggable & Timeoutable & Withinable & Shadow>) => {
    const defaultOptions = { timeout: 10000, ...options };

    if (ariaLabel) {
      // Find close button by specific aria-label (supports both PF5 and PF6)
      cy.get(
        `button[aria-label="${ariaLabel}"], .pf-v6-c-button[aria-label="${ariaLabel}"], ` +
          `.pf-v5-c-button[aria-label="${ariaLabel}"]`,
        defaultOptions,
      );
    } else {
      // Find any close button by common aria-label patterns (supports both PF5 and PF6)
      cy.get(
        'button[aria-label*="Close"], button[aria-label*="close"], button[aria-label*="Remove"], .pf-v6-c-button[aria-label*="Close"], .pf-v5-c-button[aria-label*="Close"], .pf-v6-c-button[aria-label*="Remove"], .pf-v5-c-button[aria-label*="Remove"]',
        defaultOptions,
      );
    }
  },
);

Cypress.Commands.add(
  'interceptQuery',
  (
    alias: string,
    query: string,
    conversationId: string | null = null,
    attachments: Array<OlsAttachment> = [],
  ) => {
    cy.intercept('POST', getOlsApiUrl('/v1/streaming_query'), (request) => {
      expect(request.body.media_type).to.equal('application/json');
      expect(request.body.conversation_id).to.equal(conversationId);
      expect(request.body.query).to.equal(query);

      expect(request.body.attachments).to.have.lengthOf(attachments.length);
      attachments.forEach((a, i) => {
        expect(request.body.attachments[i].attachment_type).to.equal(a.attachment_type);
        expect(request.body.attachments[i].content_type).to.equal(a.content_type);
      });

      request.reply({ body: MOCK_STREAMED_RESPONSE_BODY, delay: 1000 });
    }).as(alias);
  },
);

Cypress.Commands.add(
  'interceptQueryWithError',
  (alias: string, query: string, errorMessage: string) => {
    cy.intercept('POST', getOlsApiUrl('/v1/streaming_query'), (request) => {
      expect(request.body.query).to.equal(query);
      const responseBody = MOCK_STREAMED_RESPONSE_WITH_ERROR_BODY.replace(
        'MOCK_ERROR_MESSAGE',
        errorMessage,
      );
      request.reply({ body: responseBody, delay: 500 });
    }).as(alias);
  },
);

Cypress.Commands.add(
  'interceptFeedback',
  (
    alias: string,
    conversationId: string,
    sentiment: number,
    userFeedback: string,
    userQuestionStartsWith: string,
  ) => {
    cy.intercept('POST', getOlsApiUrl('/v1/feedback'), (request) => {
      const bodyWithoutUserQuestion = { ...request.body };
      delete bodyWithoutUserQuestion.user_question;

      expect(bodyWithoutUserQuestion).to.deep.equal({
        /* eslint-disable camelcase */
        conversation_id: conversationId,
        sentiment,
        user_feedback: userFeedback,
        llm_response: 'Mock OLS response',
        /* eslint-enable camelcase */
      });
      expect(request.body.user_question.startsWith(userQuestionStartsWith)).to.equal(true);

      request.reply(USER_FEEDBACK_MOCK_RESPONSE);
    }).as(alias);
  },
);
