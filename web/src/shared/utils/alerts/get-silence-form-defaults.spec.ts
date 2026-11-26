import { Silence, SilenceStates } from '@openshift-console/dynamic-plugin-sdk';

import { getSilenceFormDefaults } from '@/shared/utils/alerts/get-silence-form-defaults';

const makeSilence = (state: SilenceStates): Silence => ({
  id: 'silence-example',
  comment: 'Investigating',
  createdBy: 'test-user',
  startsAt: new Date(2026, 0, 1, 9, 5, 3).toISOString(),
  endsAt: new Date(2026, 0, 1, 11, 5, 3).toISOString(),
  matchers: [{ name: 'namespace', value: 'team-.*', isEqual: true, isRegex: true }],
  status: { state },
  firingAlerts: [],
});

it.each([SilenceStates.Active, SilenceStates.Pending])(
  'formats dates and preserves editable fields for a %s silence',
  (state) => {
    const silence = makeSilence(state);
    const original = structuredClone(silence);

    expect(getSilenceFormDefaults(silence)).toEqual({
      id: silence.id,
      comment: silence.comment,
      createdBy: silence.createdBy,
      startsAt: '2026/01/01 09:05:03',
      endsAt: '2026/01/01 11:05:03',
      matchers: silence.matchers,
    });
    expect(silence).toEqual(original);
  },
);

it('clears dates when recreating an expired silence without changing its other defaults', () => {
  const silence = makeSilence(SilenceStates.Expired);
  const original = structuredClone(silence);

  expect(getSilenceFormDefaults(silence)).toEqual({
    id: silence.id,
    comment: silence.comment,
    createdBy: silence.createdBy,
    startsAt: undefined,
    endsAt: undefined,
    matchers: silence.matchers,
  });
  expect(silence).toEqual(original);
});
