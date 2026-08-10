import { MemoryRouter } from 'react-router';

import SummaryCard from '@/features/mcp-overview/components/summary/SummaryCard';
import { DataTestIDs } from '@/shared/constants/data-test';

const mountCard = (props: {
  count: number;
  title: string;
  url: string;
  cardId: string;
  loading?: boolean;
  error?: string;
}) => {
  cy.mount(
    <MemoryRouter>
      <SummaryCard {...props} />
    </MemoryRouter>,
  );
};

describe('SummaryCard', () => {
  it('renders title and count, and navigates on click', () => {
    mountCard({
      cardId: 'metrics',
      count: 42,
      title: 'Metrics',
      url: '/monitoring/query-browser',
    });

    cy.get(`[data-test="${DataTestIDs.McpOverviewPage.SummaryCard}-metrics"]`).should('be.visible');
    cy.contains('h3', 'Metrics').should('be.visible');
    cy.get(`[data-test="${DataTestIDs.McpOverviewPage.SummaryCardCount}-metrics"]`)
      .should('be.visible')
      .should('contain.text', '42')
      .click();

    cy.location('pathname').should('eq', '/monitoring/query-browser');
  });

  it('renders loading state', () => {
    mountCard({
      cardId: 'targets',
      count: 0,
      title: 'Targets',
      url: '/monitoring/targets',
      loading: true,
    });

    cy.get(`[data-test="${DataTestIDs.McpOverviewPage.SummaryCardLoading}-targets"]`).should(
      'be.visible',
    );
    cy.get(`[data-test="${DataTestIDs.McpOverviewPage.SummaryCardCount}-targets"]`).should(
      'not.exist',
    );
    cy.get(`[data-test="${DataTestIDs.McpOverviewPage.SummaryCardError}-targets"]`).should(
      'not.exist',
    );
  });

  it('renders error state', () => {
    mountCard({
      cardId: 'dashboards',
      count: 0,
      title: 'Perses Dashboards',
      url: '/monitoring/v2/dashboards',
      error: 'Failed to fetch dashboards',
    });

    cy.get(`[data-test="${DataTestIDs.McpOverviewPage.SummaryCardError}-dashboards"]`).should(
      'be.visible',
    );
    cy.get(`[data-test="${DataTestIDs.McpOverviewPage.SummaryCardCount}-dashboards"]`).should(
      'not.exist',
    );
  });
});
