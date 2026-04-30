import { Silence } from '@openshift-console/dynamic-plugin-sdk';
import { ALL_NAMESPACES_KEY, fuzzyCaseInsensitive, silenceState } from '../utils';
import { Perspective } from '../../store/actions';
import { SilenceFilterOptions, SilenceFilters } from './SilencesPage';

export const filterSilences = (
  silences: Silence[],
  selectedFilters: SilenceFilters,
  namespace: string,
  perspective: Perspective,
) => {
  if (!silences) {
    return [];
  }

  const shouldFilterNamespace = namespace !== ALL_NAMESPACES_KEY;
  /**
   * Filters alerts based on tenancy:
   * - with tenancy: alerts are automatically pre-filtered.
   * - without tenancy (admin): filters by selected namespace for UX consistency.
   * - "All Projects": returns all alerts, including those without a namespace label.
   */
  return silences.filter((silence) => {
    if (
      shouldFilterNamespace &&
      !silences?.filter((s) =>
        s.matchers.some((m) => m.name === 'namespace' && m.value === namespace),
      )
    ) {
      return false;
    }
    // For each selectable filter, first check if it is set. If it isn't then we don't
    // filter
    if (
      selectedFilters[SilenceFilterOptions.NAME] &&
      !fuzzyCaseInsensitive(selectedFilters[SilenceFilterOptions.NAME], silence?.name)
    ) {
      return false;
    }
    if (
      selectedFilters[SilenceFilterOptions.STATE].length > 0 &&
      !selectedFilters[SilenceFilterOptions.STATE].includes(silenceState(silence))
    ) {
      return false;
    }
    if (
      perspective === 'acm' &&
      selectedFilters[SilenceFilterOptions.CLUSTER]?.length > 0 &&
      !selectedFilters[SilenceFilterOptions.CLUSTER].some((filter) =>
        fuzzyCaseInsensitive(
          filter,
          silence.matchers?.find((label) => label.name === 'cluster')?.value,
        ),
      )
    ) {
      return false;
    }
    return true;
  });
};
