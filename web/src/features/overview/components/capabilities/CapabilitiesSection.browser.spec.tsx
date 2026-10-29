import { MemoryRouter } from 'react-router';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { AdvancedSection } from '@/features/overview/components/capabilities/AdvancedSection';
import { CapabilitiesSection } from '@/features/overview/components/capabilities/CapabilitiesSection';
import { buildCapability, monitoringPlugin } from '@/features/overview/test-utils/fixtures';
import { capabilityCard } from '@/features/overview/test-utils/selectors';
import { DataTestIDs } from '@/shared/constants/data-test';

const capabilities = [
  buildCapability(),
  buildCapability({ id: 'logging', title: 'Logging' }),
  buildCapability({ id: 'dashboards', title: 'Dashboards' }),
];

const cards = () =>
  document.querySelectorAll(`[data-test^="${DataTestIDs.OverviewPage.CapabilityCard}-"]`);

describe.each([
  {
    name: 'CapabilitiesSection',
    Section: CapabilitiesSection,
    heading: 'Capabilities',
    sectionId: DataTestIDs.OverviewPage.CapabilitiesSection,
    loadingId: DataTestIDs.OverviewPage.InstalledLoading,
  },
  {
    name: 'AdvancedSection',
    Section: AdvancedSection,
    heading: 'Advanced analytics',
    sectionId: DataTestIDs.OverviewPage.AdvancedSection,
    loadingId: DataTestIDs.OverviewPage.RecommendedLoading,
  },
])('$name', ({ Section, heading, sectionId, loadingId }) => {
  it('renders one card per capability once loaded', async () => {
    await render(
      <MemoryRouter>
        <Section capabilities={capabilities} loaded monitoringPlugin={monitoringPlugin} />
      </MemoryRouter>,
    );
    await expect.element(page.getByTestId(sectionId)).toBeVisible();
    await expect.element(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect.poll(() => cards().length).toBe(3);
    for (const id of ['monitoring', 'logging', 'dashboards']) {
      await expect.element(capabilityCard(id)).toBeVisible();
    }
  });

  it('shows a spinner and no cards while loading', async () => {
    await render(
      <MemoryRouter>
        <Section capabilities={capabilities} loaded={false} monitoringPlugin={monitoringPlugin} />
      </MemoryRouter>,
    );
    await expect.element(page.getByTestId(loadingId)).toBeVisible();
    await expect.poll(() => cards().length).toBe(0);
  });
});

it('renders the heading with no cards when there are no capabilities', async () => {
  await render(
    <MemoryRouter>
      <CapabilitiesSection capabilities={[]} loaded monitoringPlugin={monitoringPlugin} />
    </MemoryRouter>,
  );
  await expect
    .element(page.getByRole('heading', { name: 'Capabilities', exact: true }))
    .toBeVisible();
  await expect.poll(() => cards().length).toBe(0);
});
