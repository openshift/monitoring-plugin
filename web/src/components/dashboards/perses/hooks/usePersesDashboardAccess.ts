import { AccessReviewResourceAttributes } from '@openshift-console/dynamic-plugin-sdk';
import { useAccessReview } from './useAccessReview';

export type DashboardVerb = 'create' | 'update' | 'delete';

export const usePersesDashboardAccess = (
  verb: DashboardVerb,
  namespace: string | null = null,
  enabled = true,
): [boolean, boolean] => {
  const resourceAttributes: AccessReviewResourceAttributes = {
    group: 'perses.dev',
    resource: 'persesdashboards',
    verb,
    namespace,
  };
  return useAccessReview(resourceAttributes, enabled && !!namespace);
};
