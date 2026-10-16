import { parseName, parseResources, ResourceLabel } from '@/features/logging/ParseResources';

const mixedData = {
  __error__: 'JSONParserErr',
  __error_details__: "Value looks like object, but can't find closing '}' symbol",
  k8s_container_name: 'klusterlet-agent-otel-test',
  k8s_namespace_name: 'open-cluster-management-agent-otel-test',
  k8s_node_name: 'ip-10-0-42-168.ec2.internal',
  k8s_pod_label_app: 'klusterlet-agent',
  k8s_pod_label_pod_template_hash: '7df874f76f',
  k8s_pod_name: 'klusterlet-agent-7df874f76f-2kc4l-otel-test',
  k8s_pod_uid: '0fab9ca9-97cc-4598-a525-e4fa5774d62c',
  kubernetes_container_name: 'klusterlet-agent-viaq-test',
  kubernetes_host: 'ip-10-0-42-168.ec2.internal',
  kubernetes_namespace_name: 'open-cluster-management-agent-viaq-test',
  kubernetes_pod_name: 'klusterlet-agent-7df874f76f-2kc4l-viaq-test',
  level: 'info',
  log_iostream: 'stderr',
  log_source: 'container',
  log_type: 'application',
  observed_timestamp: '1743697964398933611',
  openshift_cluster_id: '6aac5cf3-d9ee-4a8d-bc5d-921b8278c7bb',
  openshift_cluster_uid: '6aac5cf3-d9ee-4a8d-bc5d-921b8278c7bb',
  openshift_log_source: 'container',
  openshift_log_type: 'application',
  severity_text: 'info',
};

const viaqData = {
  kubernetes_container_name: 'klusterlet-agent-viaq-test',
  kubernetes_namespace_name: 'open-cluster-management-agent-viaq-test',
  kubernetes_pod_name: 'klusterlet-agent-7df874f76f-2kc4l-viaq-test',
  level: 'warning-viaq-test',
};

const otelData = {
  k8s_container_name: 'klusterlet-agent-otel-test',
  k8s_namespace_name: 'open-cluster-management-agent-otel-test',
  k8s_pod_name: 'klusterlet-agent-7df874f76f-2kc4l-otel-test',
  severity_text: 'warning-otel-test',
};

describe('Parse Resources Namespace, Name, Pod', () => {
  it('Should parse OpenTelemtry stream labels', () => {
    const resources = parseResources(otelData);
    const expectOtel = [
      {
        kind: 'Namespace',
        name: 'open-cluster-management-agent-otel-test',
      },
      {
        kind: 'Pod',
        name: 'klusterlet-agent-7df874f76f-2kc4l-otel-test',
      },
      {
        kind: 'Container',
        name: 'klusterlet-agent-otel-test',
      },
    ];
    expect(resources).toEqual(expectOtel);
  });
  it('Should parse ViaQ stream labels', () => {
    const resources = parseResources(viaqData);
    const expectViaQ = [
      {
        kind: 'Namespace',
        name: 'open-cluster-management-agent-viaq-test',
      },
      {
        kind: 'Pod',
        name: 'klusterlet-agent-7df874f76f-2kc4l-viaq-test',
      },
      {
        kind: 'Container',
        name: 'klusterlet-agent-viaq-test',
      },
    ];
    expect(resources).toEqual(expectViaQ);
  });
  it('Should parse OpenTelemetry stream labels first when both sets of stream labels are present', () => {
    const resources = parseResources(mixedData);
    const expectOtel = [
      {
        kind: 'Namespace',
        name: 'open-cluster-management-agent-otel-test',
      },
      {
        kind: 'Pod',
        name: 'klusterlet-agent-7df874f76f-2kc4l-otel-test',
      },
      {
        kind: 'Container',
        name: 'klusterlet-agent-otel-test',
      },
    ];
    expect(resources).toEqual(expectOtel);
  });
});

describe('Test parseName ', () => {
  it('Should parse OpenTelemtry stream labels ', () => {
    const severity = parseName(otelData, ResourceLabel.Severity);
    expect(severity).toEqual(otelData.severity_text);
  });
  it('Should parse ViaQ stream labels ', () => {
    const severity = parseName(viaqData, ResourceLabel.Severity);
    expect(severity).toEqual(viaqData.level);
  });
  it('Should parse OpenTelemetry stream labels first when both sets of stream labels are present', () => {
    const severity = parseName(otelData, ResourceLabel.Severity);
    expect(severity).toEqual(otelData.severity_text);
  });
});
