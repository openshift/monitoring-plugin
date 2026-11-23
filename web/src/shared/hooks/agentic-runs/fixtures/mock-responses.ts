import type { K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';

import { AgenticRunModel } from '@/shared/console/models';
import {
  AGENTIC_RUN_LABEL_FINGERPRINT,
  AGENTIC_RUN_LABEL_SOURCE,
  AGENTIC_RUN_SOURCE_ALERTMANAGER,
} from '@/shared/hooks/agentic-runs/constants';

const delayMs = 2_000;

export const getMockAgenticRunsResponse = (
  namespace: string,
  alertFingerprint: string,
): Promise<K8sResourceCommon[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          apiVersion: `${AgenticRunModel.apiGroup}/${AgenticRunModel.apiVersion}`,
          kind: AgenticRunModel.kind,
          metadata: {
            name: `mock-investigation-${alertFingerprint}`,
            namespace,
            creationTimestamp: new Date().toISOString(),
            labels: {
              [AGENTIC_RUN_LABEL_FINGERPRINT]: alertFingerprint,
              [AGENTIC_RUN_LABEL_SOURCE]: AGENTIC_RUN_SOURCE_ALERTMANAGER,
            },
          },
        },
      ]);
    }, delayMs);
  });
};
