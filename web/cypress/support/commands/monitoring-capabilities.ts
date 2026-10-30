import type { COOSetupOptions } from './operator-commands';

interface MonitoringConfig {
  perses?: { enabled?: boolean };
  incidents?: { enabled?: boolean };
  clusterHealthAnalyzer?: { enabled?: boolean };
}

interface MonitoringPod {
  metadata: { name: string };
  spec?: { containers?: Array<{ args?: string[] }> };
}

export function monitoringConfigErrors(
  config: MonitoringConfig | undefined,
  opts: Required<COOSetupOptions>,
): string[] {
  const errors: string[] = [];
  if (opts.dashboards && config?.perses?.enabled !== true) {
    errors.push('monitoring UIPlugin has Perses disabled');
  }
  // Newer COO translates either field to cluster-health-analyzer. Check the
  // effective pod arguments separately for older operators that do not.
  if (
    opts.healthAnalyzer &&
    config?.clusterHealthAnalyzer?.enabled !== true &&
    config?.incidents?.enabled !== true
  ) {
    errors.push('monitoring UIPlugin has cluster health analyzer disabled');
  }
  return errors;
}

export function monitoringFeatureErrors(
  pods: MonitoringPod[],
  opts: Required<COOSetupOptions>,
): string[] {
  const requiredFeatures: string[] = [];
  if (opts.dashboards) {
    requiredFeatures.push('perses-dashboards');
  }
  if (opts.healthAnalyzer) {
    requiredFeatures.push('cluster-health-analyzer');
  }

  return pods.flatMap((pod) => {
    const args = pod.spec?.containers?.[0]?.args || [];
    let features: string[] = [];
    args.forEach((arg, index) => {
      if (arg.startsWith('-features=') || arg.startsWith('--features=')) {
        features = arg.slice(arg.indexOf('=') + 1).split(',');
      } else if (arg === '-features' || arg === '--features') {
        features = (args[index + 1] || '').split(',');
      }
    });
    return requiredFeatures
      .filter((feature) => !features.includes(feature))
      .map((feature) => `monitoring pod ${pod.metadata.name} is missing feature ${feature}`);
  });
}
