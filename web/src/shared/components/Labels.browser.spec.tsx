import { render } from 'vitest-browser-react';

import { Labels } from '@/shared/components/Labels';

describe('Labels', () => {
  it('renders "No labels" when labels is empty', async () => {
    const screen = await render(<Labels labels={{}} />);
    await expect.element(screen.getByText('No labels')).toBeVisible();
  });

  it('renders "No labels" when labels is undefined', async () => {
    const screen = await render(<Labels labels={undefined} />);
    await expect.element(screen.getByText('No labels')).toBeVisible();
  });

  it('renders a single label', async () => {
    const screen = await render(<Labels labels={{ app: 'monitoring' }} />);
    await expect.element(screen.getByText('app', { exact: true })).toBeVisible();
    await expect.element(screen.getByText('monitoring', { exact: true })).toBeVisible();
  });

  it('renders multiple labels', async () => {
    const labels = { app: 'monitoring', env: 'production', team: 'platform' };
    const screen = await render(<Labels labels={labels} />);
    for (const [key, value] of Object.entries(labels)) {
      await expect.element(screen.getByText(key, { exact: true })).toBeVisible();
      await expect.element(screen.getByText(value, { exact: true })).toBeVisible();
    }
  });

  it('renders label with key=value format', async () => {
    const screen = await render(<Labels labels={{ severity: 'critical' }} />);
    await expect
      .element(screen.container.querySelector<HTMLElement>('.pf-v6-c-label'))
      .toHaveTextContent('severity=critical');
  });
});
