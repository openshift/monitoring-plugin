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

export const HYPERCONVERGED_CLUSTER_OPERATOR = {
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
