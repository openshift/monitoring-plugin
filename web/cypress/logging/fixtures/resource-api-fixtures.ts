export const projectListResponse = {
  kind: 'ProjectList',
  apiVersion: 'project.openshift.io/v1',
  metadata: {
    resourceVersion: '359980',
  },
  items: [
    {
      metadata: {
        name: 'default',
        resourceVersion: '30941',
      },
    },
    {
      metadata: {
        name: 'gitops',
        resourceVersion: '216367',
      },
    },
    {
      metadata: {
        name: 'gitops-service-argocd',
        resourceVersion: '230472',
      },
    },
  ],
};

export const namespaceListResponse = {
  kind: 'NamespaceList',
  apiVersion: 'v1',
  metadata: {
    resourceVersion: '359980',
  },
  items: [
    {
      metadata: {
        name: 'default',
        resourceVersion: '30941',
      },
      spec: {
        finalizers: ['kubernetes'],
      },
      status: {
        phase: 'Active',
      },
    },
    {
      metadata: {
        name: 'gitops',
        resourceVersion: '216367',
      },
      spec: {
        finalizers: ['kubernetes'],
      },
      status: {
        phase: 'Active',
      },
    },
    {
      metadata: {
        name: 'gitops-service-argocd',
        resourceVersion: '230472',
      },
      spec: {
        finalizers: ['kubernetes'],
      },
      status: {
        phase: 'Active',
      },
    },
  ],
};

export const podsLabelValuesResponse = {
  data: ['my-pod', 'default', 'gitops', 'gitops-service-argocd'],
};

export const containersLabelValuesResponse = {
  data: [
    {
      kubernetes_pod_name: 'my-pod-from-labels',
      kubernetes_container_name: 'my-container-from-labels',
    },
    { kubernetes_pod_name: 'my-pod-from-labels', kubernetes_container_name: 'my-container' },
    { kubernetes_pod_name: 'my-pod-from-labels', kubernetes_container_name: 'container-1' },
    { kubernetes_pod_name: 'my-pod-2', kubernetes_container_name: 'container-2' },
    { kubernetes_pod_name: 'my-pod-3', kubernetes_container_name: 'container-3' },
  ],
};

export const podsListResponse = {
  kind: 'PodList',
  apiVersion: 'v1',
  metadata: {
    resourceVersion: '398977',
  },
  items: [
    {
      metadata: {
        name: 'my-pod',
        generateName: 'rabbitmq-cluster-operator-5f67b69776-',
        namespace: 'rabbitmq-system',
        uid: 'd5ca7335-a01c-4ca6-b24a-0a7db79ee59a',
        resourceVersion: '37727',
        creationTimestamp: '2022-12-13T04:54:50Z',
        labels: {
          'app.kubernetes.io/component': 'rabbitmq-operator',
          'app.kubernetes.io/name': 'rabbitmq-cluster-operator',
          'app.kubernetes.io/part-of': 'rabbitmq',
          'pod-template-hash': '5f67b69776',
        },
        annotations: {
          'k8s.v1.cni.cncf.io/network-status':
            '[{\n    "name": "openshift-sdn",\n    "interface": "eth0",\n    "ips": [\n        "10.131.0.26"\n    ],\n    "default": true,\n    "dns": {}\n}]',
          'k8s.v1.cni.cncf.io/networks-status':
            '[{\n    "name": "openshift-sdn",\n    "interface": "eth0",\n    "ips": [\n        "10.131.0.26"\n    ],\n    "default": true,\n    "dns": {}\n}]',
          'openshift.io/scc': 'restricted-v2',
          'seccomp.security.alpha.kubernetes.io/pod': 'runtime/default',
        },
        ownerReferences: [
          {
            apiVersion: 'apps/v1',
            kind: 'ReplicaSet',
            name: 'rabbitmq-cluster-operator-5f67b69776',
            uid: '5c49db6b-efa0-47b1-9d18-8cf02831567b',
            controller: true,
            blockOwnerDeletion: true,
          },
        ],
        managedFields: [
          {
            manager: 'kube-controller-manager',
            operation: 'Update',
            apiVersion: 'v1',
            time: '2022-12-13T04:54:50Z',
            fieldsType: 'FieldsV1',
            fieldsV1: {
              'f:metadata': {
                'f:generateName': {},
                'f:labels': {
                  '.': {},
                  'f:app.kubernetes.io/component': {},
                  'f:app.kubernetes.io/name': {},
                  'f:app.kubernetes.io/part-of': {},
                  'f:pod-template-hash': {},
                },
                'f:ownerReferences': {
                  '.': {},
                  'k:{"uid":"5c49db6b-efa0-47b1-9d18-8cf02831567b"}': {},
                },
              },
              'f:spec': {
                'f:containers': {
                  'k:{"name":"operator"}': {
                    '.': {},
                    'f:command': {},
                    'f:env': {
                      '.': {},
                      'k:{"name":"OPERATOR_NAMESPACE"}': {
                        '.': {},
                        'f:name': {},
                        'f:valueFrom': {
                          '.': {},
                          'f:fieldRef': {},
                        },
                      },
                    },
                    'f:image': {},
                    'f:imagePullPolicy': {},
                    'f:name': {},
                    'f:ports': {
                      '.': {},
                      'k:{"containerPort":9782,"protocol":"TCP"}': {
                        '.': {},
                        'f:containerPort': {},
                        'f:name': {},
                        'f:protocol': {},
                      },
                    },
                    'f:resources': {
                      '.': {},
                      'f:limits': {
                        '.': {},
                        'f:cpu': {},
                        'f:memory': {},
                      },
                      'f:requests': {
                        '.': {},
                        'f:cpu': {},
                        'f:memory': {},
                      },
                    },
                    'f:terminationMessagePath': {},
                    'f:terminationMessagePolicy': {},
                  },
                },
                'f:dnsPolicy': {},
                'f:enableServiceLinks': {},
                'f:restartPolicy': {},
                'f:schedulerName': {},
                'f:securityContext': {},
                'f:serviceAccount': {},
                'f:serviceAccountName': {},
                'f:terminationGracePeriodSeconds': {},
              },
            },
          },
          {
            manager: 'multus',
            operation: 'Update',
            apiVersion: 'v1',
            time: '2022-12-13T04:54:52Z',
            fieldsType: 'FieldsV1',
            fieldsV1: {
              'f:metadata': {
                'f:annotations': {
                  'f:k8s.v1.cni.cncf.io/network-status': {},
                  'f:k8s.v1.cni.cncf.io/networks-status': {},
                },
              },
            },
            subresource: 'status',
          },
          {
            manager: 'kubelet',
            operation: 'Update',
            apiVersion: 'v1',
            time: '2022-12-13T04:54:54Z',
            fieldsType: 'FieldsV1',
            fieldsV1: {
              'f:status': {
                'f:conditions': {
                  'k:{"type":"ContainersReady"}': {
                    '.': {},
                    'f:lastProbeTime': {},
                    'f:lastTransitionTime': {},
                    'f:status': {},
                    'f:type': {},
                  },
                  'k:{"type":"Initialized"}': {
                    '.': {},
                    'f:lastProbeTime': {},
                    'f:lastTransitionTime': {},
                    'f:status': {},
                    'f:type': {},
                  },
                  'k:{"type":"Ready"}': {
                    '.': {},
                    'f:lastProbeTime': {},
                    'f:lastTransitionTime': {},
                    'f:status': {},
                    'f:type': {},
                  },
                },
                'f:containerStatuses': {},
                'f:hostIP': {},
                'f:phase': {},
                'f:podIP': {},
                'f:podIPs': {
                  '.': {},
                  'k:{"ip":"10.131.0.26"}': {
                    '.': {},
                    'f:ip': {},
                  },
                },
                'f:startTime': {},
              },
            },
            subresource: 'status',
          },
        ],
      },
      spec: {
        volumes: [
          {
            name: 'kube-api-access-rbggn',
            projected: {
              sources: [
                {
                  serviceAccountToken: {
                    expirationSeconds: 3607,
                    path: 'token',
                  },
                },
                {
                  configMap: {
                    name: 'kube-root-ca.crt',
                    items: [
                      {
                        key: 'ca.crt',
                        path: 'ca.crt',
                      },
                    ],
                  },
                },
                {
                  downwardAPI: {
                    items: [
                      {
                        path: 'namespace',
                        fieldRef: {
                          apiVersion: 'v1',
                          fieldPath: 'metadata.namespace',
                        },
                      },
                    ],
                  },
                },
                {
                  configMap: {
                    name: 'openshift-service-ca.crt',
                    items: [
                      {
                        key: 'service-ca.crt',
                        path: 'service-ca.crt',
                      },
                    ],
                  },
                },
              ],
              defaultMode: 420,
            },
          },
        ],
        containers: [
          {
            name: 'operator',
            image: 'rabbitmqoperator/cluster-operator:1.9.0',
            command: ['/manager'],
            ports: [
              {
                name: 'metrics',
                containerPort: 9782,
                protocol: 'TCP',
              },
            ],
            env: [
              {
                name: 'OPERATOR_NAMESPACE',
                valueFrom: {
                  fieldRef: {
                    apiVersion: 'v1',
                    fieldPath: 'metadata.namespace',
                  },
                },
              },
            ],
            resources: {
              limits: {
                cpu: '200m',
                memory: '500Mi',
              },
              requests: {
                cpu: '200m',
                memory: '500Mi',
              },
            },
            volumeMounts: [
              {
                name: 'kube-api-access-rbggn',
                readOnly: true,
                mountPath: '/var/run/secrets/kubernetes.io/serviceaccount',
              },
            ],
            terminationMessagePath: '/dev/termination-log',
            terminationMessagePolicy: 'File',
            imagePullPolicy: 'IfNotPresent',
            securityContext: {
              capabilities: {
                drop: ['ALL'],
              },
              runAsUser: 1000630000,
              runAsNonRoot: true,
              allowPrivilegeEscalation: false,
            },
          },
        ],
        restartPolicy: 'Always',
        terminationGracePeriodSeconds: 10,
        dnsPolicy: 'ClusterFirst',
        serviceAccountName: 'rabbitmq-cluster-operator',
        serviceAccount: 'rabbitmq-cluster-operator',
        nodeName: 'ip-10-0-149-55.us-east-2.compute.internal',
        securityContext: {
          seLinuxOptions: {
            level: 's0:c25,c15',
          },
          fsGroup: 1000630000,
          seccompProfile: {
            type: 'RuntimeDefault',
          },
        },
        imagePullSecrets: [
          {
            name: 'rabbitmq-cluster-operator-dockercfg-x8bd6',
          },
        ],
        schedulerName: 'default-scheduler',
        tolerations: [
          {
            key: 'node.kubernetes.io/not-ready',
            operator: 'Exists',
            effect: 'NoExecute',
            tolerationSeconds: 300,
          },
          {
            key: 'node.kubernetes.io/unreachable',
            operator: 'Exists',
            effect: 'NoExecute',
            tolerationSeconds: 300,
          },
          {
            key: 'node.kubernetes.io/memory-pressure',
            operator: 'Exists',
            effect: 'NoSchedule',
          },
        ],
        priority: 0,
        enableServiceLinks: true,
        preemptionPolicy: 'PreemptLowerPriority',
      },
      status: {
        phase: 'Running',
        conditions: [
          {
            type: 'Initialized',
            status: 'True',
            lastProbeTime: null,
            lastTransitionTime: '2022-12-13T04:54:50Z',
          },
          {
            type: 'Ready',
            status: 'True',
            lastProbeTime: null,
            lastTransitionTime: '2022-12-13T04:54:54Z',
          },
          {
            type: 'ContainersReady',
            status: 'True',
            lastProbeTime: null,
            lastTransitionTime: '2022-12-13T04:54:54Z',
          },
          {
            type: 'PodScheduled',
            status: 'True',
            lastProbeTime: null,
            lastTransitionTime: '2022-12-13T04:54:50Z',
          },
        ],
        hostIP: '10.0.149.55',
        podIP: '10.131.0.26',
        podIPs: [
          {
            ip: '10.131.0.26',
          },
        ],
        startTime: '2022-12-13T04:54:50Z',
        containerStatuses: [
          {
            name: 'operator',
            state: {
              running: {
                startedAt: '2022-12-13T04:54:54Z',
              },
            },
            lastState: {},
            ready: true,
            restartCount: 0,
            image: 'docker.io/rabbitmqoperator/cluster-operator:1.9.0',
            imageID:
              'docker.io/rabbitmqoperator/cluster-operator@sha256:02e634bb7ebef2f85f4d34e10bcaafc15eea1b95369c2c01f0727c2358ea9c37',
            containerID: 'cri-o://57c9f03831706cf5a45db865f43bcc4183f6e6381f5ee46931cc0c0efd5dfdc5',
            started: true,
          },
        ],
        qosClass: 'Guaranteed',
      },
    },
    {
      metadata: {
        name: 'my-pod-2',
        generateName: 'rabbitmq-cluster-operator-5f67b69776-',
        namespace: 'rabbitmq-system',
        uid: 'd5ca7335-a01c-4ca6-b24a-0a7db79ee59a',
        resourceVersion: '37727',
        creationTimestamp: '2022-12-13T04:54:50Z',
        labels: {
          'app.kubernetes.io/component': 'rabbitmq-operator',
          'app.kubernetes.io/name': 'rabbitmq-cluster-operator',
          'app.kubernetes.io/part-of': 'rabbitmq',
          'pod-template-hash': '5f67b69776',
        },
        annotations: {
          'k8s.v1.cni.cncf.io/network-status':
            '[{\n    "name": "openshift-sdn",\n    "interface": "eth0",\n    "ips": [\n        "10.131.0.26"\n    ],\n    "default": true,\n    "dns": {}\n}]',
          'k8s.v1.cni.cncf.io/networks-status':
            '[{\n    "name": "openshift-sdn",\n    "interface": "eth0",\n    "ips": [\n        "10.131.0.26"\n    ],\n    "default": true,\n    "dns": {}\n}]',
          'openshift.io/scc': 'restricted-v2',
          'seccomp.security.alpha.kubernetes.io/pod': 'runtime/default',
        },
        ownerReferences: [
          {
            apiVersion: 'apps/v1',
            kind: 'ReplicaSet',
            name: 'rabbitmq-cluster-operator-5f67b69776',
            uid: '5c49db6b-efa0-47b1-9d18-8cf02831567b',
            controller: true,
            blockOwnerDeletion: true,
          },
        ],
        managedFields: [
          {
            manager: 'kube-controller-manager',
            operation: 'Update',
            apiVersion: 'v1',
            time: '2022-12-13T04:54:50Z',
            fieldsType: 'FieldsV1',
            fieldsV1: {
              'f:metadata': {
                'f:generateName': {},
                'f:labels': {
                  '.': {},
                  'f:app.kubernetes.io/component': {},
                  'f:app.kubernetes.io/name': {},
                  'f:app.kubernetes.io/part-of': {},
                  'f:pod-template-hash': {},
                },
                'f:ownerReferences': {
                  '.': {},
                  'k:{"uid":"5c49db6b-efa0-47b1-9d18-8cf02831567b"}': {},
                },
              },
              'f:spec': {
                'f:containers': {
                  'k:{"name":"operator"}': {
                    '.': {},
                    'f:command': {},
                    'f:env': {
                      '.': {},
                      'k:{"name":"OPERATOR_NAMESPACE"}': {
                        '.': {},
                        'f:name': {},
                        'f:valueFrom': {
                          '.': {},
                          'f:fieldRef': {},
                        },
                      },
                    },
                    'f:image': {},
                    'f:imagePullPolicy': {},
                    'f:name': {},
                    'f:ports': {
                      '.': {},
                      'k:{"containerPort":9782,"protocol":"TCP"}': {
                        '.': {},
                        'f:containerPort': {},
                        'f:name': {},
                        'f:protocol': {},
                      },
                    },
                    'f:resources': {
                      '.': {},
                      'f:limits': {
                        '.': {},
                        'f:cpu': {},
                        'f:memory': {},
                      },
                      'f:requests': {
                        '.': {},
                        'f:cpu': {},
                        'f:memory': {},
                      },
                    },
                    'f:terminationMessagePath': {},
                    'f:terminationMessagePolicy': {},
                  },
                },
                'f:dnsPolicy': {},
                'f:enableServiceLinks': {},
                'f:restartPolicy': {},
                'f:schedulerName': {},
                'f:securityContext': {},
                'f:serviceAccount': {},
                'f:serviceAccountName': {},
                'f:terminationGracePeriodSeconds': {},
              },
            },
          },
          {
            manager: 'multus',
            operation: 'Update',
            apiVersion: 'v1',
            time: '2022-12-13T04:54:52Z',
            fieldsType: 'FieldsV1',
            fieldsV1: {
              'f:metadata': {
                'f:annotations': {
                  'f:k8s.v1.cni.cncf.io/network-status': {},
                  'f:k8s.v1.cni.cncf.io/networks-status': {},
                },
              },
            },
            subresource: 'status',
          },
          {
            manager: 'kubelet',
            operation: 'Update',
            apiVersion: 'v1',
            time: '2022-12-13T04:54:54Z',
            fieldsType: 'FieldsV1',
            fieldsV1: {
              'f:status': {
                'f:conditions': {
                  'k:{"type":"ContainersReady"}': {
                    '.': {},
                    'f:lastProbeTime': {},
                    'f:lastTransitionTime': {},
                    'f:status': {},
                    'f:type': {},
                  },
                  'k:{"type":"Initialized"}': {
                    '.': {},
                    'f:lastProbeTime': {},
                    'f:lastTransitionTime': {},
                    'f:status': {},
                    'f:type': {},
                  },
                  'k:{"type":"Ready"}': {
                    '.': {},
                    'f:lastProbeTime': {},
                    'f:lastTransitionTime': {},
                    'f:status': {},
                    'f:type': {},
                  },
                },
                'f:containerStatuses': {},
                'f:hostIP': {},
                'f:phase': {},
                'f:podIP': {},
                'f:podIPs': {
                  '.': {},
                  'k:{"ip":"10.131.0.26"}': {
                    '.': {},
                    'f:ip': {},
                  },
                },
                'f:startTime': {},
              },
            },
            subresource: 'status',
          },
        ],
      },
      spec: {
        volumes: [
          {
            name: 'kube-api-access-rbggn',
            projected: {
              sources: [
                {
                  serviceAccountToken: {
                    expirationSeconds: 3607,
                    path: 'token',
                  },
                },
                {
                  configMap: {
                    name: 'kube-root-ca.crt',
                    items: [
                      {
                        key: 'ca.crt',
                        path: 'ca.crt',
                      },
                    ],
                  },
                },
                {
                  downwardAPI: {
                    items: [
                      {
                        path: 'namespace',
                        fieldRef: {
                          apiVersion: 'v1',
                          fieldPath: 'metadata.namespace',
                        },
                      },
                    ],
                  },
                },
                {
                  configMap: {
                    name: 'openshift-service-ca.crt',
                    items: [
                      {
                        key: 'service-ca.crt',
                        path: 'service-ca.crt',
                      },
                    ],
                  },
                },
              ],
              defaultMode: 420,
            },
          },
        ],
        containers: [
          {
            name: 'operator-2',
            image: 'rabbitmqoperator/cluster-operator:1.9.0',
            command: ['/manager'],
            ports: [
              {
                name: 'metrics',
                containerPort: 9782,
                protocol: 'TCP',
              },
            ],
            env: [
              {
                name: 'OPERATOR_NAMESPACE',
                valueFrom: {
                  fieldRef: {
                    apiVersion: 'v1',
                    fieldPath: 'metadata.namespace',
                  },
                },
              },
            ],
            resources: {
              limits: {
                cpu: '200m',
                memory: '500Mi',
              },
              requests: {
                cpu: '200m',
                memory: '500Mi',
              },
            },
            volumeMounts: [
              {
                name: 'kube-api-access-rbggn',
                readOnly: true,
                mountPath: '/var/run/secrets/kubernetes.io/serviceaccount',
              },
            ],
            terminationMessagePath: '/dev/termination-log',
            terminationMessagePolicy: 'File',
            imagePullPolicy: 'IfNotPresent',
            securityContext: {
              capabilities: {
                drop: ['ALL'],
              },
              runAsUser: 1000630000,
              runAsNonRoot: true,
              allowPrivilegeEscalation: false,
            },
          },
          {
            name: 'operator',
            image: 'rabbitmqoperator/cluster-operator:1.9.0',
            command: ['/manager'],
            ports: [
              {
                name: 'metrics',
                containerPort: 9782,
                protocol: 'TCP',
              },
            ],
            env: [
              {
                name: 'OPERATOR_NAMESPACE',
                valueFrom: {
                  fieldRef: {
                    apiVersion: 'v1',
                    fieldPath: 'metadata.namespace',
                  },
                },
              },
            ],
            resources: {
              limits: {
                cpu: '200m',
                memory: '500Mi',
              },
              requests: {
                cpu: '200m',
                memory: '500Mi',
              },
            },
            volumeMounts: [
              {
                name: 'kube-api-access-rbggn',
                readOnly: true,
                mountPath: '/var/run/secrets/kubernetes.io/serviceaccount',
              },
            ],
            terminationMessagePath: '/dev/termination-log',
            terminationMessagePolicy: 'File',
            imagePullPolicy: 'IfNotPresent',
            securityContext: {
              capabilities: {
                drop: ['ALL'],
              },
              runAsUser: 1000630000,
              runAsNonRoot: true,
              allowPrivilegeEscalation: false,
            },
          },
        ],
        restartPolicy: 'Always',
        terminationGracePeriodSeconds: 10,
        dnsPolicy: 'ClusterFirst',
        serviceAccountName: 'rabbitmq-cluster-operator',
        serviceAccount: 'rabbitmq-cluster-operator',
        nodeName: 'ip-10-0-149-55.us-east-2.compute.internal',
        securityContext: {
          seLinuxOptions: {
            level: 's0:c25,c15',
          },
          fsGroup: 1000630000,
          seccompProfile: {
            type: 'RuntimeDefault',
          },
        },
        imagePullSecrets: [
          {
            name: 'rabbitmq-cluster-operator-dockercfg-x8bd6',
          },
        ],
        schedulerName: 'default-scheduler',
        tolerations: [
          {
            key: 'node.kubernetes.io/not-ready',
            operator: 'Exists',
            effect: 'NoExecute',
            tolerationSeconds: 300,
          },
          {
            key: 'node.kubernetes.io/unreachable',
            operator: 'Exists',
            effect: 'NoExecute',
            tolerationSeconds: 300,
          },
          {
            key: 'node.kubernetes.io/memory-pressure',
            operator: 'Exists',
            effect: 'NoSchedule',
          },
        ],
        priority: 0,
        enableServiceLinks: true,
        preemptionPolicy: 'PreemptLowerPriority',
      },
      status: {
        phase: 'Running',
        conditions: [
          {
            type: 'Initialized',
            status: 'True',
            lastProbeTime: null,
            lastTransitionTime: '2022-12-13T04:54:50Z',
          },
          {
            type: 'Ready',
            status: 'True',
            lastProbeTime: null,
            lastTransitionTime: '2022-12-13T04:54:54Z',
          },
          {
            type: 'ContainersReady',
            status: 'True',
            lastProbeTime: null,
            lastTransitionTime: '2022-12-13T04:54:54Z',
          },
          {
            type: 'PodScheduled',
            status: 'True',
            lastProbeTime: null,
            lastTransitionTime: '2022-12-13T04:54:50Z',
          },
        ],
        hostIP: '10.0.149.55',
        podIP: '10.131.0.26',
        podIPs: [
          {
            ip: '10.131.0.26',
          },
        ],
        startTime: '2022-12-13T04:54:50Z',
        containerStatuses: [
          {
            name: 'operator',
            state: {
              running: {
                startedAt: '2022-12-13T04:54:54Z',
              },
            },
            lastState: {},
            ready: true,
            restartCount: 0,
            image: 'docker.io/rabbitmqoperator/cluster-operator:1.9.0',
            imageID:
              'docker.io/rabbitmqoperator/cluster-operator@sha256:02e634bb7ebef2f85f4d34e10bcaafc15eea1b95369c2c01f0727c2358ea9c37',
            containerID: 'cri-o://57c9f03831706cf5a45db865f43bcc4183f6e6381f5ee46931cc0c0efd5dfdc5',
            started: true,
          },
        ],
        qosClass: 'Guaranteed',
      },
    },
  ],
};
