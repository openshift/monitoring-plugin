/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from 'react';

import { QueryKebab } from '@/features/metrics/components/QueryKebab';

type DropdownProps = PropsWithChildren<{
  isOpen: boolean;
  toggle: (toggleRef: null) => ReactNode;
}>;

type DropdownItemProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & { isAriaDisabled?: boolean }
>;

type MenuToggleProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & { isExpanded: boolean }
>;

vi.mock('@patternfly/react-core', () => ({
  Dropdown: ({ children, isOpen, toggle }: DropdownProps) => (
    <div>
      {toggle(null)}
      {isOpen && children}
    </div>
  ),
  DropdownItem: ({ children, isAriaDisabled, onClick, ...props }: DropdownItemProps) => (
    <button aria-disabled={isAriaDisabled} onClick={onClick} {...props}>
      {children}
    </button>
  ),
  DropdownList: ({ children }: PropsWithChildren) => <div>{children}</div>,
  MenuToggle: ({ children, isExpanded, onClick, ...props }: MenuToggleProps) => (
    <button aria-expanded={isExpanded} onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Tooltip: ({ children }: PropsWithChildren) => <>{children}</>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const renderQueryKebab = (text?: string, onCreateAlert = vi.fn()) => {
  render(
    <QueryKebab
      canCreateAlert
      isDisabledSeriesEmpty
      isEnabled
      onCreateAlert={onCreateAlert}
      onDelete={vi.fn()}
      onDuplicate={vi.fn()}
      onToggleAllSeries={vi.fn()}
      onToggleIsEnabled={vi.fn()}
      queryTableData={{ columns: [], rows: [] }}
      text={text}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'toggle menu' }));

  return onCreateAlert;
};

describe('QueryKebab', () => {
  it.each([undefined, '   '])('disables Create alert when the query is empty', (text) => {
    renderQueryKebab(text);
    const createAlertItem = screen.getByRole('button', { name: 'Create alert' });

    expect(createAlertItem.getAttribute('aria-disabled')).toBe('true');
  });

  it('enables Create alert and invokes its action when the query has text', () => {
    const onCreateAlert = vi.fn();
    renderQueryKebab('up', onCreateAlert);
    const createAlertItem = screen.getByRole('button', { name: 'Create alert' });

    expect(createAlertItem.getAttribute('aria-disabled')).not.toBe('true');
    fireEvent.click(createAlertItem);
    expect(onCreateAlert).toHaveBeenCalledTimes(1);
  });
});
