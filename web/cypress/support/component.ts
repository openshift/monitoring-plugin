import React from 'react';
import ReactDOM from 'react-dom';
import '@patternfly/react-core/dist/styles/base.css';

function mount(jsx: React.ReactElement) {
  const root = document.querySelector('[data-cy-root]');
  return cy.then(() => {
    ReactDOM.render(jsx, root);
  });
}

declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add('mount', mount);

// Mock react-i18next for all component tests: returns the key with {{interpolations}} replaced
const mockT = (key: string, opts?: Record<string, string>) => {
  if (opts) {
    return Object.entries(opts).reduce(
      (result, [k, v]) => result.replace(`{{${k}}}`, v),
      key,
    );
  }
  return key;
};

beforeEach(() => {
  cy.stub(require('react-i18next'), 'useTranslation').returns({ t: mockT });
});
