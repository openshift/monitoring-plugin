import {
  type AccessReviewResourceAttributes,
  checkAccess,
} from '@openshift-console/dynamic-plugin-sdk';
import { useQuery } from '@tanstack/react-query';

// reimplementation of useAccessReview from the sdk to allow for changes in resourceAttributes
// which it doesn't track
export const useAccessReview = (
  resourceAttributes: AccessReviewResourceAttributes,
  enabled = true,
): [boolean, boolean] => {
  const {
    group = '',
    resource = '',
    subresource = '',
    verb = '',
    name = '',
    namespace = '',
  } = resourceAttributes;
  const { data, isError, isLoading } = useQuery({
    queryKey: ['access-review', group, resource, subresource, verb, name, namespace],
    queryFn: () => checkAccess(resourceAttributes).then((result) => result.status.allowed),
    enabled,
    retry: false,
  });

  return [isError || data === true, enabled && isLoading];
};
