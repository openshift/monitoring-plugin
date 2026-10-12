/** @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import type { PropsWithChildren, ReactNode } from 'react';
import { CellMeasurerCache } from 'react-virtualized/dist/es/CellMeasurer';

import { VirtualizedLogsTable } from '@/features/logging/components/VirtualizedLogsTable';
import { Schema } from '@/features/logging/logs-types';

const sizing = vi.hoisted(() => ({ width: 800, recomputeRowHeights: vi.fn() }));

vi.mock('@patternfly/react-virtualized-extension', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  return {
    AutoSizer: ({ children }: { children: (size: { width: number }) => ReactNode }) =>
      children({ width: sizing.width }),
    WindowScroller: forwardRef(({ children }: { children: (size: object) => ReactNode }, ref) => {
      useImperativeHandle(ref, () => ({ updatePosition: vi.fn() }));
      return children({ height: 600, isScrolling: false, scrollTop: 0 });
    }),
    VirtualTableBody: forwardRef((_, ref) => {
      useImperativeHandle(ref, () => ({ recomputeRowHeights: sizing.recomputeRowHeights }));
      return null;
    }),
  };
});

vi.mock('@patternfly/react-table', () => {
  const Container = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    Table: Container,
    Thead: Container,
    Tr: Container,
    Th: Container,
    Tbody: Container,
    Td: Container,
  };
});

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sizing.recomputeRowHeights.mockClear();
  sizing.width = 800;
});

it('clears cached row heights and remeasures only when the width changes', () => {
  const clearAll = vi.spyOn(CellMeasurerCache.prototype, 'clearAll');
  const table = () => (
    <div style={{ overflow: 'auto' }}>
      <VirtualizedLogsTable
        Row={() => null}
        data={[]}
        columns={[]}
        getSortParams={() => undefined}
        schema={Schema.viaq}
      />
    </div>
  );
  const { rerender } = render(table());
  expect(sizing.recomputeRowHeights).not.toHaveBeenCalled();

  sizing.width = 400;
  rerender(table());
  expect(clearAll).toHaveBeenCalledOnce();
  expect(sizing.recomputeRowHeights).toHaveBeenCalledOnce();

  rerender(table());
  expect(sizing.recomputeRowHeights).toHaveBeenCalledOnce();
});
