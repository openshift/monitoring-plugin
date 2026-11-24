import { AlertStates } from '@openshift-console/dynamic-plugin-sdk';
import { Flex } from '@patternfly/react-core';

import { AlertRuleState } from '@/shared/components/AlertRuleState';

const ruleStates = {
  Enabled: 'enabled',
  Disabled: 'disabled',
  Unknown: 'unknown',
} as const;

type AlertStateSummaryProps = {
  enablement?: keyof typeof ruleStates;
  firingAlertCount: number;
  pendingAlertCount: number;
  silencedAlertCount: number;
};

export function AlertStateSummary({
  enablement,
  firingAlertCount,
  pendingAlertCount,
  silencedAlertCount,
}: AlertStateSummaryProps) {
  return (
    <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsXs' }}>
      {enablement && <AlertRuleState state={ruleStates[enablement]} />}
      {firingAlertCount > 0 && (
        <AlertRuleState state={AlertStates.Firing} count={firingAlertCount} />
      )}
      {pendingAlertCount > 0 && (
        <AlertRuleState state={AlertStates.Pending} count={pendingAlertCount} />
      )}
      {silencedAlertCount > 0 && (
        <AlertRuleState state={AlertStates.Silenced} count={silencedAlertCount} />
      )}
    </Flex>
  );
}
