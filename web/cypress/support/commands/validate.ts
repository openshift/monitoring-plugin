import type { COOSetupOptions } from './operator-commands';
import {
  CLUSTER_LOGGING_OPERATOR,
  CLUSTER_MONITORING_OPERATOR,
  CLUSTER_OBSERVABILITY_OPERATOR,
  KUBEVIRT_HYPERCONVERGED_OPERATOR,
  LOKI_OPERATOR,
  OPENTELEMETRY_OPERATOR,
  TEMPO_OPERATOR,
} from '../operators';

export enum ValidationType {
  MonitoringRoles = 'MonitoringRoles',
  MonitoringPlugin = 'MonitoringPlugin',
  ClusterObservabilityOperator = 'ClusterObservabilityOperator',
  MonitoringConsolePlugin = 'MonitoringConsolePlugin',
  PersesDashboards = 'PersesDashboards',
  PersesDatasource = 'PersesDatasource',
  PersesServer = 'PersesServer',
  TroubleshootingPanel = 'TroubleshootingPanel',
  Korrel8r = 'Korrel8r',
  HealthAnalyzer = 'HealthAnalyzer',
  Virtualization = 'Virtualization',
  OpenTelemetry = 'OpenTelemetry',
  TempoOperator = 'TempoOperator',
  LokiOperator = 'LokiOperator',
  LoggingOperator = 'LoggingOperator',
  ACMOperator = 'ACMOperator',
}

export interface ValidationFailure {
  type: ValidationType;
  error: string;
}

interface ValidationCheck {
  type: ValidationType;
  command: string;
  validate?: (stdout: string, check: ValidationCheck) => ValidationFailure[];
}

function isMissingMonitoringRoles(): Cypress.Chainable<ValidationFailure[]> {
  if (Cypress.env('LOGIN_USERNAME') === 'kubeadmin') {
    return cy.wrap([]);
  }

  const reasons: ValidationFailure[] = [];
  ['openshift-monitoring', 'default'].forEach((namespace) => {
    cy.adminCLI(`oc get rolebindings -n ${namespace} -o json`, {
      failOnNonZeroExit: false,
    }).then((result) => {
      if (result.code !== 0) {
        reasons.push({
          type: ValidationType.MonitoringRoles,
          error: `Cannot read rolebindings in ${namespace}: ${result.stderr || result.stdout}`,
        });
        return;
      }
      const bindings = JSON.parse(result.stdout).items as Array<{
        roleRef: { name: string };
        subjects?: Array<{ kind: string; name: string }>;
      }>;
      ['monitoring-edit', 'monitoring-alertmanager-edit', 'view'].forEach((role) => {
        if (
          !bindings.some(
            (binding) =>
              binding.roleRef.name === role &&
              binding.subjects?.some(
                (subject) =>
                  subject.kind === 'User' && subject.name === Cypress.env('LOGIN_USERNAME'),
              ),
          )
        ) {
          reasons.push({
            type: ValidationType.MonitoringRoles,
            error: `Missing ${role} rolebinding for ${Cypress.env('LOGIN_USERNAME')} in ${namespace}`,
          });
        }
      });
    });
  });
  return cy.then(() => reasons);
}

export function validateMonitoringPlugin(): Cypress.Chainable<ValidationFailure[]> {
  const reasons: ValidationFailure[] = [];
  isMissingMonitoringRoles().then((roleReasons) => {
    reasons.push(...roleReasons);
  });
  cy.adminCLI(
    `oc get deployment monitoring-plugin -n ${CLUSTER_MONITORING_OPERATOR.namespace} -o json`,
    {
      failOnNonZeroExit: false,
    },
  ).then((result) => {
    if (result.code !== 0) {
      reasons.push({
        type: ValidationType.MonitoringPlugin,
        error: `Cannot read monitoring-plugin deployment: ${result.stderr || result.stdout}`,
      });
      return;
    }
    const deployment = JSON.parse(result.stdout);
    if (!(Number(deployment.status?.availableReplicas) > 0)) {
      reasons.push({
        type: ValidationType.MonitoringPlugin,
        error: 'monitoring-plugin deployment has no available replicas',
      });
    }
    const image = deployment.spec?.template?.spec?.containers?.[0]?.image;
    if (Cypress.env('MP_IMAGE') && image !== Cypress.env('MP_IMAGE')) {
      reasons.push({
        type: ValidationType.MonitoringPlugin,
        error: `monitoring-plugin image ${image || '(missing)'} does not match MP_IMAGE`,
      });
    }
  });
  return cy.then(() => reasons);
}

function podReadinessReasons(
  pods: Array<{
    metadata: { name: string };
    status?: { containerStatuses?: Array<{ name: string; ready: boolean }> };
  }>,
  label: string,
  type: ValidationType,
): ValidationFailure[] {
  if (!pods.length) {
    return [{ type, error: `No ${label} pods found` }];
  }
  return pods.flatMap((pod) => {
    if (!pod.status?.containerStatuses?.length) {
      return [{ type, error: `${label} pod ${pod.metadata.name} has no container statuses` }];
    }
    return pod.status.containerStatuses
      .filter((container) => !container.ready)
      .map((container) => ({
        type,
        error: `${label} pod ${pod.metadata.name} container ${container.name} is not ready`,
      }));
  });
}

function validatePods(
  stdout: string,
  { type, command }: ValidationCheck,
  expectedImage?: string,
): ValidationFailure[] {
  const pods = JSON.parse(stdout).items || [];
  const reasons = podReadinessReasons(pods, command, type);
  if (expectedImage) {
    pods.forEach((pod) => {
      if (pod.spec?.containers?.[0]?.image !== expectedImage) {
        reasons.push({
          type,
          error: `${command}: pod ${pod.metadata.name} image does not match configured image`,
        });
      }
    });
  }
  return reasons;
}

function monitoringConsolePluginChecks(namespace: string): ValidationCheck[] {
  return [
    { type: ValidationType.MonitoringConsolePlugin, command: 'oc get uiplugin monitoring' },
    {
      type: ValidationType.MonitoringConsolePlugin,
      command: `oc get pods -l app.kubernetes.io/instance=monitoring -n ${namespace} -o json`,
      validate: (stdout, check) => validatePods(stdout, check, Cypress.env('MCP_CONSOLE_IMAGE')),
    },
  ];
}

function persesDashboardsChecks(namespace: string): ValidationCheck[] {
  return [
    {
      type: ValidationType.PersesDashboards,
      command: `oc get persesdashboard openshift-cluster-sample-dashboard -n ${namespace}`,
    },
    {
      type: ValidationType.PersesDashboards,
      command:
        'oc get persesdashboard perses-dashboard-sample prometheus-overview ' +
        'thanos-compact-overview -n perses-dev',
    },
    {
      type: ValidationType.PersesDatasource,
      command: 'oc get persesdatasource thanos-querier-datasource -n perses-dev',
    },
    {
      type: ValidationType.PersesServer,
      command: `oc get pods -l app.kubernetes.io/instance=perses -n ${namespace} -o json`,
      validate: validatePods,
    },
  ];
}

function troubleshootingPanelChecks(namespace: string): ValidationCheck[] {
  return [
    {
      type: ValidationType.TroubleshootingPanel,
      command: 'oc get uiplugin troubleshooting-panel',
    },
    {
      type: ValidationType.TroubleshootingPanel,
      command:
        'oc get pods -l app.kubernetes.io/instance=troubleshooting-panel ' +
        `-n ${namespace} -o json`,
      validate: validatePods,
    },
    {
      type: ValidationType.Korrel8r,
      command: `oc get pods -l app.kubernetes.io/instance=korrel8r -n ${namespace} -o json`,
      validate: validatePods,
    },
  ];
}

function healthAnalyzerChecks(namespace: string): ValidationCheck[] {
  return [
    {
      type: ValidationType.HealthAnalyzer,
      command: `oc get pods -l app.kubernetes.io/instance=health-analyzer -n ${namespace} -o json`,
      validate: (stdout, check) => validatePods(stdout, check, Cypress.env('CHA_IMAGE')),
    },
  ];
}

function clusterObservabilityOperatorChecks(namespace: string): ValidationCheck[] {
  return [
    {
      type: ValidationType.ClusterObservabilityOperator,
      command: `oc get deployment observability-operator -n ${namespace} -o json`,
      validate: (stdout, { type, command }) => {
        const deployment = JSON.parse(stdout);
        const reasons: ValidationFailure[] = [];
        if (!(Number(deployment.status?.availableReplicas) > 0)) {
          reasons.push({ type, error: `${command}: no available replicas` });
        }
        if (
          (Cypress.env('KONFLUX_COO_BUNDLE_IMAGE') || Cypress.env('CUSTOM_COO_BUNDLE_IMAGE')) &&
          !deployment.spec?.template?.spec?.containers?.[0]?.args?.includes(
            '--openshift.enabled=true',
          )
        ) {
          reasons.push({ type, error: `${command}: missing --openshift.enabled=true` });
        }
        return reasons;
      },
    },
  ];
}

function validateChecks(checks: ValidationCheck[]): Cypress.Chainable<ValidationFailure[]> {
  const reasons: ValidationFailure[] = [];
  checks.forEach((check) => {
    const { type, command, validate } = check;
    cy.adminCLI(command, { failOnNonZeroExit: false }).then((result) => {
      if (result.code !== 0) {
        reasons.push({
          type,
          error:
            `${command} failed: ` +
            `${result.stderr || result.stdout || `exit code ${result.code}`}`,
        });
      } else if (validate) {
        reasons.push(...validate(result.stdout, check));
      }
    });
  });
  return cy.then(() => reasons);
}

export function validateMonitoringConsolePlugin(
  opts: Required<COOSetupOptions>,
): Cypress.Chainable<ValidationFailure[]> {
  const namespace = CLUSTER_OBSERVABILITY_OPERATOR.namespace;
  const checks: ValidationCheck[] = [
    ...clusterObservabilityOperatorChecks(namespace),
    ...monitoringConsolePluginChecks(namespace),
    ...(opts.dashboards ? persesDashboardsChecks(namespace) : []),
    ...(opts.troubleshootingPanel ? troubleshootingPanelChecks(namespace) : []),
    ...(opts.healthAnalyzer ? healthAnalyzerChecks(namespace) : []),
  ];

  const reasons: ValidationFailure[] = [];
  const monitoringValidation = Cypress.env('MP_IMAGE')
    ? validateMonitoringPlugin()
    : isMissingMonitoringRoles();
  monitoringValidation.then((monitoringReasons) => {
    reasons.push(...monitoringReasons);
  });
  return validateChecks(checks).then((checkReasons) => [...reasons, ...checkReasons]);
}

function validateOperator(
  namespace: string,
  packageName: string,
  podName: string,
  type: ValidationType,
  selector?: string,
): Cypress.Chainable<ValidationFailure[]> {
  const reasons: ValidationFailure[] = [];
  cy.adminCLI(`oc get csv -n ${namespace} -o json`, { failOnNonZeroExit: false }).then((result) => {
    if (result.code !== 0) {
      reasons.push({
        type,
        error: `Cannot read CSVs in ${namespace}: ${result.stderr || result.stdout}`,
      });
      return;
    }
    const csvs = JSON.parse(result.stdout).items;
    if (
      !csvs.some(
        (csv) => csv.metadata.name.includes(packageName) && csv.status?.phase === 'Succeeded',
      )
    ) {
      reasons.push({ type, error: `No Succeeded CSV for ${packageName} in ${namespace}` });
    }
  });
  cy.adminCLI(`oc get pods -n ${namespace} ${selector ? `-l ${selector}` : ''} -o json`, {
    failOnNonZeroExit: false,
  }).then((result) => {
    if (result.code !== 0) {
      reasons.push({
        type,
        error: `Cannot read ${packageName} pods in ${namespace}: ${result.stderr || result.stdout}`,
      });
      return;
    }
    const pods = JSON.parse(result.stdout).items.filter((pod) =>
      pod.metadata.name.includes(podName),
    );
    reasons.push(...podReadinessReasons(pods, `${packageName} in ${namespace}`, type));
  });
  return cy.then(() => reasons);
}

export function validateVirtualization(): Cypress.Chainable<ValidationFailure[]> {
  const reasons: ValidationFailure[] = [];
  validateOperator(
    KUBEVIRT_HYPERCONVERGED_OPERATOR.namespace,
    KUBEVIRT_HYPERCONVERGED_OPERATOR.packageName,
    '',
    ValidationType.Virtualization,
    'app=kubevirt-hyperconverged',
  ).then((operatorReasons) => {
    reasons.push(...operatorReasons);
  });
  cy.adminCLI(
    `oc get hyperconverged ${KUBEVIRT_HYPERCONVERGED_OPERATOR.config.name} ` +
      `-n ${KUBEVIRT_HYPERCONVERGED_OPERATOR.namespace}`,
    { failOnNonZeroExit: false },
  ).then((result) => {
    if (result.code !== 0) {
      reasons.push({
        type: ValidationType.Virtualization,
        error:
          `Cannot read HyperConverged ${KUBEVIRT_HYPERCONVERGED_OPERATOR.config.name}: ` +
          (result.stderr || result.stdout),
      });
    }
  });
  return cy.then(() => reasons);
}

export function validateOtel(): Cypress.Chainable<ValidationFailure[]> {
  return validateOperator(
    OPENTELEMETRY_OPERATOR.namespace,
    OPENTELEMETRY_OPERATOR.packageName,
    'opentelemetry',
    ValidationType.OpenTelemetry,
  );
}

export function validateTempo(): Cypress.Chainable<ValidationFailure[]> {
  return validateOperator(
    TEMPO_OPERATOR.namespace,
    TEMPO_OPERATOR.packageName,
    'tempo',
    ValidationType.TempoOperator,
  );
}

export function validateLoki(): Cypress.Chainable<ValidationFailure[]> {
  return validateOperator(
    LOKI_OPERATOR.namespace,
    LOKI_OPERATOR.packageName,
    'loki',
    ValidationType.LokiOperator,
  );
}

export function validateLogging(): Cypress.Chainable<ValidationFailure[]> {
  return validateOperator(
    CLUSTER_LOGGING_OPERATOR.namespace,
    CLUSTER_LOGGING_OPERATOR.packageName,
    'logging',
    ValidationType.LoggingOperator,
  );
}

export function validateACM(): Cypress.Chainable<ValidationFailure[]> {
  const namespace = 'open-cluster-management-observability';
  const checks: ValidationCheck[] = [
    {
      type: ValidationType.ACMOperator,
      command: `oc get multiclusterobservability observability -n ${namespace}`,
    },
    {
      type: ValidationType.ACMOperator,
      command: `oc get configmap thanos-ruler-custom-rules -n ${namespace} -o json`,
      validate: (stdout) => {
        const rules = JSON.parse(stdout).data?.['custom_rules.yaml'];
        return ['Watchdog', 'Watchdog-spoke', 'ClusterCPUHealth-jb']
          .filter((alert) => !rules?.includes(`alert: ${alert}`))
          .map((alert) => ({
            type: ValidationType.ACMOperator,
            error: `ACM custom rules missing ${alert}`,
          }));
      },
    },
    {
      type: ValidationType.ACMOperator,
      command: 'oc get uiplugin monitoring -o json',
      validate: (stdout) =>
        JSON.parse(stdout).spec.monitoring?.acm?.enabled === true
          ? []
          : [{ type: ValidationType.ACMOperator, error: 'monitoring UIPlugin has ACM disabled' }],
    },
    {
      type: ValidationType.ACMOperator,
      command:
        'oc get pods -l alertmanager=observability,app=multicluster-observability-alertmanager ' +
        `-n ${namespace} -o json`,
      validate: (stdout) =>
        podReadinessReasons(
          JSON.parse(stdout).items,
          'ACM Alertmanager',
          ValidationType.ACMOperator,
        ),
    },
  ];
  return validateChecks(checks);
}
