/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { AlertFollowUpSteps } from '@/features/alert-management-api/pages/alert-details/details-tab/AlertFollowUpSteps';
import { testAlerts } from '@/features/alert-management-api/tests/fixtures/alerts-test-data';

const { check, prefetch } = vi.hoisted(() => ({ check: vi.fn(), prefetch: vi.fn() }));
vi.mock('@/shared/hooks/agentic-runs/useAgenticRunCheck', () => ({ useAgenticRunCheck: check }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

beforeEach(() => {
  prefetch.mockClear();
  check.mockReturnValue({ agenticRuns: [], hasAgenticRun: false, prefetch, isFetching: false });
});

const alert = testAlerts[0];

function renderSteps() {
  render(
    <MemoryRouter>
      <AlertFollowUpSteps alert={alert} />
    </MemoryRouter>,
  );
}

it('links to metrics using the alert rule expression', () => {
  renderSteps();
  const href = screen.getByRole('link', { name: 'See metrics' }).getAttribute('href');
  const url = new URL(href, 'https://console.example.com');
  expect(url.pathname, 'The metrics link should open the query browser').toBe(
    '/monitoring/query-browser',
  );
  expect(
    url.searchParams.get('query0'),
    'The metrics link should contain the alert rule expression',
  ).toBe(alert.rule.query);
  expect(
    prefetch,
    'Mounting follow-up steps should request matching investigations',
  ).toHaveBeenCalledOnce();
  expect(check, 'Investigation lookup should use the selected alert').toHaveBeenCalledWith(alert);
  expect(
    screen.queryByRole('link', { name: /View AI Investigation/ }),
    'The investigation link should be omitted when no run matches',
  ).toBeNull();
});

it('links to the latest matched investigation and shows the AI warning', () => {
  check.mockReturnValue({
    agenticRuns: [{ metadata: { name: 'latest-run', namespace: 'openshift-lightspeed' } }],
    hasAgenticRun: true,
    prefetch,
    isFetching: false,
  });
  renderSteps();
  expect(
    screen.getByRole('link', { name: /View AI Investigation/ }).getAttribute('href'),
    'The investigation link should point to the latest matched run',
  ).toBe('/lightspeed/runs/openshift-lightspeed/latest-run');
  expect(
    screen.getByText('Always review AI-generated content prior to use.'),
    'AI investigation links should include the review warning',
  ).toBeDefined();
});

it('shows loading status while investigations are fetched', () => {
  check.mockReturnValue({ agenticRuns: [], hasAgenticRun: false, prefetch, isFetching: true });
  renderSteps();
  expect(
    screen.getByText('Loading investigations...'),
    'Investigation lookup should show its loading status',
  ).toBeDefined();
});
