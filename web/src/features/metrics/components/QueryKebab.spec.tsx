/** @jest-environment jsdom */

import { act } from 'react';
import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

import { QueryKebab } from '@/features/metrics/components/QueryKebab';
import { DataTestIDs } from '@/shared/constants/data-test';

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

jest.mock('@patternfly/react-core', () => ({
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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const renderQueryKebab = (text?: string, onCreateAlert = jest.fn()) => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <QueryKebab
        canCreateAlert
        isDisabledSeriesEmpty
        isEnabled
        onCreateAlert={onCreateAlert}
        onDelete={jest.fn()}
        onDuplicate={jest.fn()}
        onToggleAllSeries={jest.fn()}
        onToggleIsEnabled={jest.fn()}
        queryTableData={{ columns: [], rows: [] }}
        text={text}
      />,
    );
  });

  act(() => {
    container.querySelector<HTMLButtonElement>('[data-test="kebab-dropdown-button"]')?.click();
  });

  return {
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
    onCreateAlert,
  };
};

const getCreateAlertItem = () =>
  document.querySelector<HTMLButtonElement>(
    `[data-test="${DataTestIDs.MetricsPageCreateAlertRuleDropdownItem}"]`,
  );

describe('QueryKebab', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

  afterEach(() => document.body.replaceChildren());

  it.each([undefined, '   '])('disables Create alert when the query is empty', (text) => {
    const { cleanup } = renderQueryKebab(text);
    const createAlertItem = getCreateAlertItem();

    expect(createAlertItem?.getAttribute('aria-disabled')).toBe('true');
    cleanup();
  });

  it('enables Create alert and invokes its action when the query has text', () => {
    const onCreateAlert = jest.fn();
    const { cleanup } = renderQueryKebab('up', onCreateAlert);
    const createAlertItem = getCreateAlertItem();

    expect(createAlertItem?.getAttribute('aria-disabled')).not.toBe('true');
    act(() => createAlertItem?.click());
    expect(onCreateAlert).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
