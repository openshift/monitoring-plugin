import { mount } from 'cypress/react';
import '@patternfly/react-core/dist/styles/base.css';
import * as ReactI18next from 'react-i18next';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
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
    return Object.entries(opts).reduce((result, [k, v]) => result.replace(`{{${k}}}`, v), key);
  }
  return key;
};

beforeEach(() => {
  cy.stub(ReactI18next, 'useTranslation').returns({ t: mockT });
});
