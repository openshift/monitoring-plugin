import type { K8sResourceKind, WatchK8sResult } from '@openshift-console/dynamic-plugin-sdk';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { OverviewPageContent } from '@/features/overview/components/pages/OverviewPageContent';
import { useObservabilityCapabilities } from '@/features/overview/hooks/useObservabilityCapabilities';
import {
  buildEmptyObservabilityCapabilitiesResult,
  statusIcon,
} from '@/features/overview/test-utils/fixtures';
import { capabilityCard, summaryCard } from '@/features/overview/test-utils/selectors';
import { DataTestIDs } from '@/shared/constants/data-test';

vi.mock('@/features/overview/hooks/useObservabilityCapabilities', () => ({
  useObservabilityCapabilities: vi.fn(),
}));

const mountContent = (csvResults: WatchK8sResult<K8sResourceKind[]> = [[], true, null]) =>
  render(
    <MemoryRouter>
      <OverviewPageContent csvResults={csvResults} />
    </MemoryRouter>,
  );

describe('OverviewPageContent', () => {
  beforeEach(() => {
    vi.mocked(useObservabilityCapabilities).mockReturnValue(
      buildEmptyObservabilityCapabilitiesResult(),
    );
  });

  it('renders the stack summary and capability sections once CSV watches resolve', async () => {
    await mountContent();
    for (const [id, title] of [
      [DataTestIDs.OverviewPage.SummarySection, 'Stack summary'],
      [DataTestIDs.OverviewPage.CapabilitiesSection, 'Capabilities'],
      [DataTestIDs.OverviewPage.AdvancedSection, 'Advanced analytics'],
    ]) {
      await expect.element(page.getByTestId(id)).toBeVisible();
      await expect.element(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    }
    await expect.element(summaryCard('capabilities-ready')).toBeVisible();
    await expect.element(summaryCard('component-health')).toBeVisible();
  });

  it('shows loading indicators while capability watches are still pending', async () => {
    vi.mocked(useObservabilityCapabilities).mockReturnValue({
      ...buildEmptyObservabilityCapabilitiesResult(),
      loaded: false,
    });
    await mountContent([[], false, null]);
    await expect.element(page.getByLabelText('Loading stack summary data')).toBeVisible();
    await expect.element(page.getByTestId(DataTestIDs.OverviewPage.InstalledLoading)).toBeVisible();
    await expect
      .element(page.getByTestId(DataTestIDs.OverviewPage.RecommendedLoading))
      .toBeVisible();
    await expect.element(summaryCard('capabilities-ready')).not.toBeInTheDocument();
    await expect.element(capabilityCard('logging')).not.toBeInTheDocument();
  });

  it('renders a danger alert when the CSV watch fails', async () => {
    await mountContent([[], true, 'Forbidden']);
    await expect
      .element(
        page.getByRole('heading', {
          name: 'Danger alert: Unable to determine services installation status',
          exact: true,
        }),
      )
      .toBeVisible();
    await expect.element(page.getByText('Forbidden', { exact: true })).toBeVisible();
  });

  it('reports degraded component health when nothing is installed', async () => {
    await mountContent();
    const card = summaryCard('component-health');
    await expect.element(card).toMatchTextContent('0');
    await expect.element(card).toMatchTextContent('Degraded');
    await expect.element(card).not.toMatchTextContent('Healthy');
    await expect
      .element(card.element().querySelector<HTMLElement>(statusIcon('danger')))
      .not.toBeInTheDocument();
  });

  it('offers Install links for each missing operator', async () => {
    await mountContent();
    const card = capabilityCard('logging');
    for (const name of ['Cluster Observability Operator', 'Loki Operator', 'CLO Operator']) {
      const row = page.elementLocator(
        card.getByText(name, { exact: true }).element().closest('li'),
      );
      await expect
        .element(row.getByRole('link', { name: 'Install', exact: true }))
        .toBeInTheDocument();
    }
  });
});
