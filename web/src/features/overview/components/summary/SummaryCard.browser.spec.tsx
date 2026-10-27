import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import SummaryCard, { SummaryCardProps } from '@/features/overview/components/summary/SummaryCard';
import { statusIcon } from '@/features/overview/test-utils/fixtures';
import { summaryCard } from '@/features/overview/test-utils/selectors';
import { DataTestIDs } from '@/shared/constants/data-test';

const mountCard = (props: Partial<SummaryCardProps> = {}) =>
  render(
    <SummaryCard cardId="capabilities-ready" count="3/5" title="Capabilities ready" {...props} />,
  );

const loading = () =>
  page.getByTestId(`${DataTestIDs.OverviewPage.SummaryCardLoading}-capabilities-ready`);

describe('SummaryCard', () => {
  it('renders the title and count keyed by cardId', async () => {
    await mountCard();
    await expect.element(summaryCard('capabilities-ready')).toBeVisible();
    await expect.element(page.getByRole('heading', { name: 'Capabilities ready' })).toBeVisible();
    await expect.element(summaryCard('capabilities-ready')).toHaveTextContent('3/5');
  });

  it('renders the footer when one is provided', async () => {
    await mountCard({ footer: 'Ready' });
    await expect.element(summaryCard('capabilities-ready')).toHaveTextContent('Ready');
  });

  it('omits the footer when none is provided', async () => {
    await mountCard();
    await expect
      .element(summaryCard('capabilities-ready').element().querySelector('small'))
      .not.toBeInTheDocument();
  });

  it.each([
    { status: 'success' as const, count: 7, footer: undefined },
    { status: 'danger' as const, count: 2, footer: 'Degraded' },
  ])('renders a $status status icon alongside the count', async ({ status, count, footer }) => {
    await mountCard({
      cardId: 'component-health',
      title: 'Component health',
      status,
      count,
      footer,
    });
    const card = summaryCard('component-health');
    await expect
      .element(card.element().querySelector<HTMLElement>(statusIcon(status)))
      .toBeInTheDocument();
    await expect.element(card).toHaveTextContent(String(count));
    if (footer) await expect.element(card).toHaveTextContent(footer);
  });

  it('renders the count without an icon when no status is given', async () => {
    await mountCard({ count: 12 });
    const card = summaryCard('capabilities-ready');
    await expect
      .element(card.element().querySelector<HTMLElement>('.pf-v6-c-icon'))
      .not.toBeInTheDocument();
    await expect.element(card).toHaveTextContent('12');
  });

  it('renders a spinner instead of the count while loading', async () => {
    await mountCard({ loading: true, count: 42 });
    await expect.element(loading()).toBeVisible();
    await expect.element(summaryCard('capabilities-ready')).not.toHaveTextContent('42');
  });

  it('renders an error icon instead of the count, and keeps the title visible', async () => {
    await mountCard({ error: 'Secrets are forbidden', count: 42 });
    const card = summaryCard('capabilities-ready');
    await expect
      .element(card.element().querySelector<HTMLElement>(statusIcon('danger')))
      .toBeVisible();
    await expect.element(card).not.toHaveTextContent('42');
    await expect.element(page.getByRole('heading', { name: 'Capabilities ready' })).toBeVisible();
    await expect.element(loading()).not.toBeInTheDocument();
  });

  it('exposes the error message in a tooltip', async () => {
    await mountCard({ error: 'Secrets are forbidden' });
    const icon = summaryCard('capabilities-ready').element().querySelector(statusIcon('danger'));
    await page.elementLocator(icon).hover();
    await expect.element(page.getByRole('tooltip')).toHaveTextContent('Secrets are forbidden');
  });

  it('prefers the loading state over the error state', async () => {
    await mountCard({ loading: true, error: 'Secrets are forbidden' });
    await expect.element(loading()).toBeVisible();
    await expect
      .element(
        summaryCard('capabilities-ready')
          .element()
          .querySelector<HTMLElement>(statusIcon('danger')),
      )
      .not.toBeInTheDocument();
  });
});
