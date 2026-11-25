/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import { SeverityFilter } from '@/features/alert-management-api/components/filters/SeverityFilter';
import { getSeverityColors } from '@/shared/utils/alerts/formatting';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      key.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => values?.[name] ?? name),
  }),
}));

const options = ['critical', 'warning', 'info'].map((value) => ({
  value,
  label: value,
  count: 1,
}));

const button = (severity: string) =>
  screen.getByRole('button', { name: `Filter ${severity} alerts` });
const background = (severity: string) =>
  button(severity)
    .querySelector<HTMLElement>('.pf-v6-c-label')!
    .style.getPropertyValue('--pf-v6-c-label--BackgroundColor');

it('shows available severities without dimming them when there is no selection', () => {
  render(<SeverityFilter options={options} selected={[]} onChange={vi.fn()} />);

  expect(screen.getByText('Severity')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Filter none alerts' })).toBeNull();
  for (const { value } of options) {
    expect(background(value)).toBe('');
    expect(button(value).getAttribute('aria-pressed')).toBe('false');
  }
});

it('adds and removes severities without changing the supplied selection', () => {
  const onChange = vi.fn();
  const selected = ['critical'];
  const { rerender } = render(
    <SeverityFilter options={options} selected={selected} onChange={onChange} />,
  );

  expect(button('critical').getAttribute('aria-pressed')).toBe('true');
  expect(button('warning').getAttribute('aria-pressed')).toBe('false');
  expect(background('critical')).toBe('');
  expect(background('warning')).toBe(getSeverityColors('warning').mutedBackgroundColor);

  fireEvent.click(button('warning'));

  expect(onChange).toHaveBeenLastCalledWith(['critical', 'warning']);
  expect(selected).toEqual(['critical']);

  rerender(
    <SeverityFilter options={options} selected={['critical', 'warning']} onChange={onChange} />,
  );
  expect(button('critical').getAttribute('aria-pressed')).toBe('true');
  expect(button('warning').getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(button('critical'));

  expect(onChange).toHaveBeenLastCalledWith(['warning']);

  rerender(<SeverityFilter options={options} selected={['warning']} onChange={onChange} />);
  expect(button('critical').getAttribute('aria-pressed')).toBe('false');
  expect(button('warning').getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(button('warning'));

  expect(onChange).toHaveBeenLastCalledWith([]);

  rerender(<SeverityFilter options={options} selected={[]} onChange={onChange} />);
  for (const { value } of options) {
    expect(button(value).getAttribute('aria-pressed')).toBe('false');
  }
});

it('supports rule-specific accessible labels', () => {
  render(
    <SeverityFilter
      options={options}
      selected={[]}
      getAriaLabel={(severity) => `Filter ${severity} rules`}
      onChange={vi.fn()}
    />,
  );

  expect(screen.getByRole('button', { name: 'Filter critical rules' })).toBeDefined();
});

it('handles an empty set of available severities', () => {
  render(<SeverityFilter options={[]} selected={[]} onChange={vi.fn()} />);

  expect(screen.getByText('Severity')).toBeDefined();
  expect(screen.queryByRole('button')).toBeNull();
});
