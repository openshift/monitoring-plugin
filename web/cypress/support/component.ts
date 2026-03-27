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
