import { useAccessReview } from '@openshift-console/dynamic-plugin-sdk';
import type { AccessReviewResourceAttributes } from '@openshift-console/dynamic-plugin-sdk';

export type DashboardVerb = 'create' | 'update' | 'delete';

export const usePersesDashboardAccess = (
  verb: DashboardVerb,
  namespace: string | null = null,
  enabled = true,
): [boolean, boolean] => {
  // set to {} when not enabled to prevent fetching access
  const resourceAttributes: AccessReviewResourceAttributes = enabled
    ? { group: 'perses.dev', resource: 'persesdashboards', verb, namespace }
    : {};
  return useAccessReview(resourceAttributes, undefined, true);
};
