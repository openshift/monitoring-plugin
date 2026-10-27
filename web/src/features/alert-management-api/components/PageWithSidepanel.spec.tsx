/** @vitest-environment jsdom */

// jsdom does not calculate layout; these tests only check structure, styles, and behavior.
// After the Playwright migration, convert the layout regression check to a Playwright component
// test verifying panel/backdrop alignment and scrolling at desktop and narrow viewport widths.

import { Drawer, DrawerContent, DrawerPanelContent } from '@patternfly/react-core';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useState } from 'react';

import { PageWithSidepanel } from '@/features/alert-management-api/components/PageWithSidepanel';
import { DataTestIDs } from '@/shared/constants/data-test';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function StatefulChild() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}

const page = (isOpen: boolean, onClose = vi.fn()) => (
  <PageWithSidepanel
    isOpen={isOpen}
    onClose={onClose}
    title="Alert details"
    panel={<p>Panel content</p>}
  >
    <StatefulChild />
  </PageWithSidepanel>
);

it('preserves child state and node identity while toggling modal isolation', () => {
  const { rerender } = render(page(false));
  const child = screen.getByRole('button', { name: 'Count: 0' });
  const content = child.parentElement;
  fireEvent.click(child);

  expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
  expect(content.hasAttribute('inert')).toBe(false);
  expect(screen.queryByTestId(DataTestIDs.PageWithSidepanel.Backdrop)).toBeNull();

  rerender(page(true));
  expect(screen.getByText('Panel content')).toBeDefined();
  expect(screen.getByText('Count: 1')).toBe(child);
  expect(
    screen.getByTestId(DataTestIDs.PageWithSidepanel.Backdrop).getAttribute('aria-hidden'),
  ).toBe('true');
  rerender(page(false));
  expect(screen.getByRole('button', { name: 'Count: 1' })).toBe(child);
  expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
  expect(screen.queryByText('Panel content')).toBeNull();
  expect(screen.queryByTestId(DataTestIDs.PageWithSidepanel.Backdrop)).toBeNull();
});

it('declares a non-scrolling frame and stationary backdrop inside nested drawers', () => {
  const stylesheet = document.createElement('style');
  stylesheet.textContent = readFileSync(
    resolve(__dirname, '../assets/page-with-sidepanel.css'),
    'utf8',
  );
  document.head.append(stylesheet);

  try {
    render(
      <Drawer>
        <DrawerContent panelContent={<DrawerPanelContent />}>{page(true)}</DrawerContent>
      </Drawer>,
    );
    const backdrop = screen.getByTestId(DataTestIDs.PageWithSidepanel.Backdrop);
    const panel = screen.getByTestId(DataTestIDs.PageWithSidepanel.Panel);
    const frame = panel.parentElement;
    const frameStyle = getComputedStyle(frame);
    const backdropStyle = getComputedStyle(backdrop);

    expect(frameStyle.overflow).toBe('clip');
    expect(frameStyle.minWidth).toBe('0px');
    expect(frameStyle.minHeight).toBe('0px');
    expect(frameStyle.position).toBe('relative');
    expect(frameStyle.isolation).toBe('isolate');
    expect(backdrop.parentElement).toBe(frame);
    expect(backdropStyle.position).toBe('absolute');
    expect(backdropStyle.inset).toBe('0px');
  } finally {
    stylesheet.remove();
  }
});

it('calls onClose from the close button, Escape, and backdrop, but not panel content', async () => {
  const onClose = vi.fn();
  render(page(true, onClose));

  fireEvent.click(screen.getByText('Panel content'));
  expect(onClose).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
  expect(onClose).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByTestId(DataTestIDs.PageWithSidepanel.Backdrop));
  expect(onClose).toHaveBeenCalledTimes(2);
});
