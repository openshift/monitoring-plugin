import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { StackSummary } from '@/features/overview/components/summary/StackSummary';
import {
  buildCapability,
  buildConfig,
  buildOperator,
  cooCSV,
  statusIcon,
} from '@/features/overview/test-utils/fixtures';
import { summaryCard } from '@/features/overview/test-utils/selectors';
import {
  CapabilityStatus,
  ObservabilityCapability,
  RequirementStatus,
} from '@/features/overview/types/types';
import { DataTestIDs } from '@/shared/constants/data-test';

const mixedCapabilities = [
  buildCapability(),
  buildCapability({
    id: 'logging',
    title: 'Logging',
    status: CapabilityStatus.Available,
    requiredOperators: [buildOperator({ status: RequirementStatus.Missing, csv: undefined })],
    requiredConfigs: [buildConfig({ status: RequirementStatus.Missing })],
  }),
];

const mountSummary = (capabilities: ObservabilityCapability[], loaded = true) =>
  render(<StackSummary observabilityCapabilities={capabilities} loaded={loaded} />);

const expectDegraded = async (count: number) => {
  const card = summaryCard('component-health');
  await expect.element(card).toMatchTextContent(String(count));
  await expect.element(card).toMatchTextContent('Degraded');
  await expect.element(card).not.toMatchTextContent('Healthy');
  const icon = card.element().querySelector<HTMLElement>(statusIcon('danger'));
  if (count) {
    await expect.element(icon).toBeInTheDocument();
  } else {
    await expect.element(icon).not.toBeInTheDocument();
  }
};

describe('StackSummary', () => {
  it('renders the section heading', async () => {
    await mountSummary(mixedCapabilities);
    await expect.element(page.getByTestId(DataTestIDs.OverviewPage.SummarySection)).toBeVisible();
    await expect.element(page.getByRole('heading', { name: 'Stack summary' })).toBeVisible();
  });

  it('shows a spinner and no cards until the capabilities have loaded', async () => {
    await mountSummary(mixedCapabilities, false);
    await expect.element(page.getByLabelText('Loading stack summary data')).toBeVisible();
    await expect.element(summaryCard('capabilities-ready')).not.toBeInTheDocument();
    await expect.element(summaryCard('component-health')).not.toBeInTheDocument();
  });

  it('counts ready capabilities out of the total', async () => {
    await mountSummary(mixedCapabilities);
    const card = summaryCard('capabilities-ready');
    await expect.element(card).toBeVisible();
    for (const text of ['Capabilities ready', '1/2', 'Ready']) {
      await expect.element(card).toMatchTextContent(text);
    }
  });

  it('reports 0 ready when nothing is configured', async () => {
    await mountSummary([mixedCapabilities[1]]);
    await expect.element(summaryCard('capabilities-ready')).toMatchTextContent('0/1');
  });

  it('counts healthy capabilities across the catalog', async () => {
    await mountSummary(mixedCapabilities);
    const card = summaryCard('component-health');
    await expect.element(card).toBeVisible();
    for (const text of ['Component health', '1', 'Healthy']) {
      await expect.element(card).toMatchTextContent(text);
    }
    await expect
      .element(card.element().querySelector<HTMLElement>(statusIcon('success')))
      .toBeInTheDocument();
  });

  it('counts each degraded operator once when shared across capabilities', async () => {
    const operator = buildOperator({
      status: RequirementStatus.Degraded,
      csv: { ...cooCSV, metadata: { ...cooCSV.metadata, uid: 'shared-degraded-operator-uid' } },
    });
    await mountSummary(
      ['monitoring', 'logging'].map((id) =>
        buildCapability({
          id,
          requiredOperators: [{ ...operator }],
          requiredConfigs: [buildConfig({ status: RequirementStatus.Success })],
        }),
      ),
    );
    await expectDegraded(1);
  });

  it('switches to a degraded count when any requirement is degraded', async () => {
    await mountSummary([
      buildCapability({
        status: CapabilityStatus.Partial,
        requiredOperators: [buildOperator({ status: RequirementStatus.Degraded })],
        requiredConfigs: [buildConfig({ status: RequirementStatus.Success })],
      }),
    ]);
    await expectDegraded(1);
  });

  it('reports degraded component health when no requirements are healthy', async () => {
    await mountSummary([mixedCapabilities[1]]);
    await expectDegraded(0);
  });

  it('renders both cards with an empty capability list', async () => {
    await mountSummary([]);
    await expect.element(summaryCard('capabilities-ready')).toMatchTextContent('0/0');
    await expectDegraded(0);
  });
});
