/** @vitest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';

import { SpanControls } from '@/shared/components/query-browser/QueryBrowser';
import { MAX_TIMESPAN_MS } from '@/shared/constants/timespan';

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

  it('accepts 365 days and rejects any longer span', () => {
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

    const input = screen.getByRole('textbox', { name: 'graph timespan' });
    fireEvent.change(input, { target: { value: '365d' } });
    fireEvent.change(input, { target: { value: '365d 1s' } });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '365d' } });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(onChange).toHaveBeenCalledExactlyOnceWith(MAX_TIMESPAN_MS);
  });
});
