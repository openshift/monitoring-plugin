import SummaryCard, { SummaryCardProps } from '@/features/overview/components/summary/SummaryCard';
import { DataTestIDs } from '@/shared/constants/data-test';

import { statusIcon } from './fixtures';

const card = (cardId: string) =>
  cy.get(`[data-test="${DataTestIDs.OverviewPage.SummaryCard}-${cardId}"]`);
const loading = (cardId: string) =>
  cy.get(`[data-test="${DataTestIDs.OverviewPage.SummaryCardLoading}-${cardId}"]`);

const mountCard = (props: Partial<SummaryCardProps> = {}) => {
  cy.mount(
    <SummaryCard cardId="capabilities-ready" count="3/5" title="Capabilities ready" {...props} />,
  );
};

describe('SummaryCard', () => {
  it('renders the title and count keyed by cardId', () => {
    mountCard();

    card('capabilities-ready').should('be.visible');
    cy.contains('h3', 'Capabilities ready').should('be.visible');
    card('capabilities-ready').should('contain.text', '3/5');
  });

  it('renders the footer when one is provided', () => {
    mountCard({ footer: 'Ready' });

    card('capabilities-ready').should('contain.text', 'Ready');
  });

  it('omits the footer when none is provided', () => {
    mountCard();

    card('capabilities-ready').find('small').should('not.exist');
  });

  it('renders a success status icon alongside the count', () => {
    mountCard({
      cardId: 'component-health',
      count: 7,
      title: 'Component health',
      status: 'success',
    });

    card('component-health').within(() => {
      cy.get(statusIcon('success')).should('exist');
      cy.root().should('contain.text', '7');
    });
  });

  it('renders a danger status icon alongside the count', () => {
    mountCard({
      cardId: 'component-health',
      count: 2,
      title: 'Component health',
      status: 'danger',
      footer: 'Degraded',
    });

    card('component-health').within(() => {
      cy.get(statusIcon('danger')).should('exist');
      cy.root().should('contain.text', '2').and('contain.text', 'Degraded');
    });
  });

  it('renders the count without an icon when no status is given', () => {
    mountCard({ count: 12 });

    card('capabilities-ready').within(() => {
      cy.get('.pf-v6-c-icon').should('not.exist');
      cy.root().should('contain.text', '12');
    });
  });

  it('renders a spinner instead of the count while loading', () => {
    mountCard({ loading: true, count: 42 });

    loading('capabilities-ready').should('be.visible');
    card('capabilities-ready').should('not.contain.text', '42');
  });

  it('renders an error icon instead of the count, and keeps the title visible', () => {
    mountCard({ error: 'Secrets are forbidden', count: 42 });

    card('capabilities-ready').within(() => {
      cy.get(statusIcon('danger')).should('be.visible');
      cy.root().should('not.contain.text', '42');
    });
    cy.contains('h3', 'Capabilities ready').should('be.visible');
    loading('capabilities-ready').should('not.exist');
  });

  it('exposes the error message in a tooltip', () => {
    mountCard({ error: 'Secrets are forbidden' });

    card('capabilities-ready').find(statusIcon('danger')).trigger('mouseenter');
    cy.get('[role="tooltip"]').should('contain.text', 'Secrets are forbidden');
  });

  it('prefers the loading state over the error state', () => {
    mountCard({ loading: true, error: 'Secrets are forbidden' });

    loading('capabilities-ready').should('be.visible');
    card('capabilities-ready').find(statusIcon('danger')).should('not.exist');
  });
});
