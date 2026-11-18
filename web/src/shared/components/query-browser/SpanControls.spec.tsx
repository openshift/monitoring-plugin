/** @vitest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';

import { SpanControls } from '@/shared/components/query-browser/QueryBrowser';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (text: string) => text }),
}));

describe('SpanControls', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the reset range when a same-duration preset is pending', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(
      <SpanControls
        defaultSpanText="30m"
        hasReducedResolution={false}
        onChange={onChange}
        span={5 * 60 * 1000}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'graph timespan' }));
    fireEvent.click(screen.getByText('5m'));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Reset zoom' }));
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onChange.mock.calls).toEqual([[30 * 60 * 1000]]);
  });
});
