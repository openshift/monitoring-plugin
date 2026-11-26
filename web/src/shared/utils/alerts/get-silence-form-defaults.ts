import { Silence, SilenceStates } from '@openshift-console/dynamic-plugin-sdk';

import { silenceState } from '@/shared/utils/alerts/formatting';
import { formatSilenceDate } from '@/shared/utils/date';

export const getSilenceFormDefaults = (silence: Silence) => {
  const { comment, createdBy, endsAt, id, matchers, startsAt } = silence;
  const isExpired = silenceState(silence) === SilenceStates.Expired;

  return {
    comment,
    createdBy,
    endsAt: isExpired ? undefined : formatSilenceDate(new Date(endsAt)),
    id,
    matchers,
    startsAt: isExpired ? undefined : formatSilenceDate(new Date(startsAt)),
  };
};
