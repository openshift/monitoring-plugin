import 'cypress-wait-until';

/**
 * Poll until pods matching a label selector reach the Ready condition.
 * Replaces the `sleep N && oc wait` anti-pattern — proceeds as soon as
 * the pod is ready instead of sleeping a fixed duration first.
 *
 * Handles the case where pods don't exist yet (oc wait fails immediately
 * with "no matching resources") by retrying until the overall timeout.
 */
export function waitForPodsReady(
  selector: string,
  namespace: string,
  timeoutMs?: number,
  intervalMs: number = 5000,
): void {
  const kubeconfig = Cypress.env('KUBECONFIG_PATH');
  const timeout = timeoutMs ?? (Cypress.config('readyTimeoutMilliseconds') as number);

  cy.waitUntil(
    () =>
      cy
        .exec(
          `oc wait --for=condition=Ready pods --selector=${selector} -n ${namespace} --timeout=10s --kubeconfig ${kubeconfig}`,
          { failOnNonZeroExit: false, timeout: 20000 },
        )
        .then((result) => result.code === 0),
    {
      timeout,
      interval: intervalMs,
      errorMsg: `Pods with selector '${selector}' not ready in '${namespace}' within ${timeout / 1000}s`,
    },
  );
}

/**
 * Like waitForPodsReady but also accepts "no matching resources found"
 * as a success condition (useful for optional components on fresh clusters).
 */
export function waitForPodsReadyOrAbsent(
  selector: string,
  namespace: string,
  timeoutMs?: number,
  intervalMs: number = 5000,
): void {
  const kubeconfig = Cypress.env('KUBECONFIG_PATH');
  const timeout = timeoutMs ?? (Cypress.config('readyTimeoutMilliseconds') as number);

  cy.waitUntil(
    () =>
      cy
        .exec(
          `oc wait --for=condition=Ready pods --selector=${selector} -n ${namespace} --timeout=10s --kubeconfig ${kubeconfig}`,
          { failOnNonZeroExit: false, timeout: 20000 },
        )
        .then(
          (result) =>
            result.code === 0 || result.stderr.includes('no matching resources found'),
        ),
    {
      timeout,
      interval: intervalMs,
      errorMsg: `Pods with selector '${selector}' neither ready nor absent in '${namespace}' within ${timeout / 1000}s`,
    },
  );
}

/**
 * Poll until an arbitrary `oc wait` condition is met on a resource.
 * Useful for non-pod resources like ServiceMonitors.
 */
export function waitForResourceCondition(
  resource: string,
  condition: string,
  namespace: string,
  timeoutMs?: number,
  intervalMs: number = 5000,
): void {
  const kubeconfig = Cypress.env('KUBECONFIG_PATH');
  const timeout = timeoutMs ?? (Cypress.config('readyTimeoutMilliseconds') as number);

  cy.waitUntil(
    () =>
      cy
        .exec(
          `oc wait --for=${condition} ${resource} -n ${namespace} --timeout=10s --kubeconfig ${kubeconfig}`,
          { failOnNonZeroExit: false, timeout: 20000 },
        )
        .then((result) => result.code === 0),
    {
      timeout,
      interval: intervalMs,
      errorMsg: `Condition '${condition}' not met for '${resource}' in '${namespace}' within ${timeout / 1000}s`,
    },
  );
}
