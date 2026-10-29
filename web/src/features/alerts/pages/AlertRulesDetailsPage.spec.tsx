/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { PrometheusTemplate } from '@/features/alerts/components/ActiveAlerts';

describe('PrometheusTemplate', () => {
  it('linkifies plain-text parts and keeps template tags as code', () => {
    render(
      <PrometheusTemplate
        text={'See https://runbooks.example.com/alert for {{ $labels.namespace }}.'}
      />,
    );

    expect(
      screen.getByRole('link', { name: 'https://runbooks.example.com/alert' }).getAttribute('href'),
    ).toBe('https://runbooks.example.com/alert');
    expect(screen.queryByRole('link', { name: /labels/ })).toBeNull();
    expect(screen.getByText('{{ $labels.namespace }}').tagName).toBe('CODE');
  });

  it('prefixes scheme-less URLs with the https protocol', () => {
    render(<PrometheusTemplate text={'See www.runbooks.example.com/alert'} />);

    expect(
      screen.getByRole('link', { name: 'www.runbooks.example.com/alert' }).getAttribute('href'),
    ).toBe('https://www.runbooks.example.com/alert');
  });

  it('renders unsafe URLs as plain text', () => {
    render(<PrometheusTemplate text="Blocked file:///etc/passwd and javascript:alert(1)" />);

    expect(screen.queryByRole('link')).toBeNull();
  });
});
