import { MemoryRouter } from 'react-router';

import AdvancedSection from '@/features/overview/components/capabilities/AdvancedSection';
import CapabilitiesSection from '@/features/overview/components/capabilities/CapabilitiesSection';
import { ObservabilityCapability } from '@/features/overview/types/types';
import { DataTestIDs } from '@/shared/constants/data-test';

import { buildCapability, monitoringPlugin } from './fixtures';

const capabilityCard = (id: string) =>
  cy.get(`[data-test="${DataTestIDs.OverviewPage.CapabilityCard}-${id}"]`);

const allCapabilityCards = () =>
  cy.get(`[data-test^="${DataTestIDs.OverviewPage.CapabilityCard}-"]`);

const capabilities: ObservabilityCapability[] = [
  buildCapability(),
  buildCapability({ id: 'logging', title: 'Logging' }),
  buildCapability({ id: 'dashboards', title: 'Dashboards' }),
];

const mountSection = (Section: typeof CapabilitiesSection, props: { loaded: boolean }) => {
  cy.mount(
    <MemoryRouter>
      <Section
        capabilities={capabilities}
        loaded={props.loaded}
        monitoringPlugin={monitoringPlugin}
      />
    </MemoryRouter>,
  );
};

describe('CapabilitiesSection', () => {
  it('renders one card per capability once loaded', () => {
    mountSection(CapabilitiesSection, { loaded: true });

    cy.get(`[data-test="${DataTestIDs.OverviewPage.CapabilitiesSection}"]`).should('be.visible');
    cy.contains('h2', 'Capabilities').should('be.visible');
    allCapabilityCards().should('have.length', 3);
    capabilityCard('monitoring').should('be.visible');
    capabilityCard('logging').should('be.visible');
    capabilityCard('dashboards').should('be.visible');
  });

  it('shows a spinner and no cards while loading', () => {
    mountSection(CapabilitiesSection, { loaded: false });

    cy.get(`[data-test="${DataTestIDs.OverviewPage.InstalledLoading}"]`).should('be.visible');
    allCapabilityCards().should('not.exist');
  });

  it('renders the heading with no cards when there are no capabilities', () => {
    cy.mount(
      <MemoryRouter>
        <CapabilitiesSection capabilities={[]} loaded monitoringPlugin={monitoringPlugin} />
      </MemoryRouter>,
    );

    cy.contains('h2', 'Capabilities').should('be.visible');
    allCapabilityCards().should('not.exist');
  });
});

describe('AdvancedSection', () => {
  it('renders one card per capability once loaded', () => {
    mountSection(AdvancedSection, { loaded: true });

    cy.get(`[data-test="${DataTestIDs.OverviewPage.AdvancedSection}"]`).should('be.visible');
    cy.contains('h2', 'Advanced analytics').should('be.visible');
    allCapabilityCards().should('have.length', 3);
  });

  it('shows a spinner and no cards while loading', () => {
    mountSection(AdvancedSection, { loaded: false });

    cy.get(`[data-test="${DataTestIDs.OverviewPage.RecommendedLoading}"]`).should('be.visible');
    allCapabilityCards().should('not.exist');
  });
});
