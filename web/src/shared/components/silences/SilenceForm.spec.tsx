/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { SilenceFormContent } from '@/shared/components/silences/SilenceForm';
import { getAlertmanagerSilencesUrl } from '@/shared/utils/utils';

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@openshift-console/dynamic-plugin-sdk', async () => ({
  ...(await vi.importActual('@/shared/test-utils/sdk-const-enums')),
  consoleFetchJSON: { post: mocks.post },
  DocumentTitle: () => null,
}));
vi.mock('react-redux', () => ({
  useSelector: () => ({ username: 'test-user' }),
}));
vi.mock('@/shared/hooks/useMonitoring', () => ({
  useMonitoring: () => ({ prometheus: 'cmo' }),
}));
vi.mock('@/shared/hooks/useMonitoringNamespace', () => ({
  useMonitoringNamespace: () => ({ namespace: 'team-b' }),
}));
vi.mock('@/shared/hooks/useAlerts', () => ({
  useAlerts: () => {
    throw new Error('Reusable form must not poll legacy alerts');
  },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.post.mockResolvedValue({ silenceID: 'saved-id' });
});

function mount(isNamespaced = true) {
  const onSuccess = vi.fn();
  const onCancel = vi.fn();
  const matchers = [
    { name: 'namespace', value: 'team-b', isRegex: false, isEqual: true },
    { name: 'alertname', value: 'Example', isRegex: false, isEqual: true },
  ];
  render(
    <SilenceFormContent
      defaults={{ matchers }}
      title="Create silence"
      isNamespaced={isNamespaced}
      onSuccess={onSuccess}
      onCancel={onCancel}
    />,
  );
  return { onSuccess, onCancel, matchers };
}

it.each([true, false])(
  'saves with matching namespace context when tenancy is %s',
  async (isNamespaced) => {
    const { onSuccess, matchers } = mount(isNamespaced);
    fireEvent.change(screen.getByRole('textbox', { name: 'Comment' }), {
      target: { value: 'Investigating' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Silence' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledExactlyOnceWith('saved-id'));
    expect(mocks.post).toHaveBeenCalledWith(
      getAlertmanagerSilencesUrl({
        prometheus: 'cmo',
        namespace: 'team-b',
        useTenancyPath: isNamespaced,
      }),
      expect.objectContaining({
        comment: 'Investigating',
        createdBy: 'test-user',
        matchers: expect.arrayContaining(matchers),
      }),
    );
    expect(mocks.post.mock.calls[0][1].matchers).toHaveLength(2);
  },
);

it('keeps failed saves on the form and displays the error', async () => {
  mocks.post.mockRejectedValue(new Error('Save failed'));
  const { onSuccess } = mount();
  fireEvent.change(screen.getByRole('textbox', { name: 'Comment' }), {
    target: { value: 'Investigating' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Silence' }));
  await screen.findByText('Save failed');
  expect(onSuccess).not.toHaveBeenCalled();
  expect((screen.getByRole('button', { name: 'Silence' }) as HTMLButtonElement).disabled).toBe(
    false,
  );
});

it('uses the supplied cancel action without submitting', () => {
  const { onCancel } = mount();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledOnce();
  expect(mocks.post).not.toHaveBeenCalled();
});
