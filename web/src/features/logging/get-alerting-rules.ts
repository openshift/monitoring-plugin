import { getConfig } from '@/features/logging/backend-client';
import { RulesResponse } from '@/features/logging/logs-types';
import { getRules } from '@/features/logging/loki-client';
import { namespaceBelongsToInfrastructureTenant } from '@/features/logging/value-utils';

const abortControllers: Map<string, null | (() => void)> = new Map();

export const getAlertingRules = async (tenants: Array<string>, namespace?: string) => {
  let tenansToConsider = tenants;

  // If namespace is provided, filter the provided tenants according to the namespace
  if (namespace) {
    if (namespaceBelongsToInfrastructureTenant(namespace)) {
      tenansToConsider = tenants.filter(
        (tenant) => tenant === 'infrastructure' || tenant === 'audit',
      );
    } else {
      tenansToConsider = tenants.filter((tenant) => tenant === 'application');
    }
  }

  if (tenansToConsider.length === 0) {
    return null;
  }

  const config = await getConfig();

  const rulesResponses = await Promise.allSettled(
    tenants.map((tenant) => {
      if (abortControllers.has(tenant)) {
        abortControllers.get(tenant)?.();
      }

      const { abort, request } = getRules({ tenant, namespace, config });
      abortControllers.set(tenant, abort);

      return request();
    }),
  );

  const mergedRules: RulesResponse = rulesResponses
    .flatMap((response) =>
      response.status === 'fulfilled' && response.value.status === 'success'
        ? [response.value]
        : [],
    )
    .reduce(
      (acc, rules) => {
        acc.data.groups = acc.data.groups.concat(rules.data.groups);

        return acc;
      },
      { data: { groups: [] }, status: 'success' } as RulesResponse,
    );

  return mergedRules;
};
