export const CLUSTER_MONITORING_OPERATOR = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

export const CLUSTER_OBSERVABILITY_OPERATOR = {
  namespace: 'openshift-cluster-observability-operator',
  packageName: 'cluster-observability-operator',
  operatorName: 'Cluster Observability Operator',
  config: {
    kind: 'UIPlugin',
    name: 'monitoring',
  },
};

export const KUBEVIRT_HYPERCONVERGED_OPERATOR = {
  namespace: 'openshift-cnv',
  packageName: 'kubevirt-hyperconverged',
  config: {
    kind: 'HyperConverged',
    name: 'kubevirt-hyperconverged',
  },
  crd: {
    kubevirt: 'kubevirts.kubevirt.io',
    hyperconverged: 'hyperconvergeds.hco.kubevirt.io',
  },
};

export const OPENTELEMETRY_OPERATOR = {
  namespace: 'openshift-opentelemetry-operator',
  packageName: 'opentelemetry-product',
  operatorName: 'Red Hat build of OpenTelemetry',
};

export const TEMPO_OPERATOR = {
  namespace: 'openshift-tempo-operator',
  packageName: 'tempo-product',
  operatorName: 'Tempo Operator',
};

export const LOKI_OPERATOR = {
  namespace: 'openshift-operators-redhat',
  packageName: 'loki-operator',
  operatorName: 'Loki Operator',
};

export const CLUSTER_LOGGING_OPERATOR = {
  namespace: 'openshift-logging',
  packageName: 'cluster-logging',
  operatorName: 'Logging Operator',
};
