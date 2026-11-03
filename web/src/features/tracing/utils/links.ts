// Note: this file must be kept in sync with the route definitions in console-extensions.json

export function linkToTrace() {
  // by capturing the entire URL search params, we can provide a breadcrumb to the previous page with the Tempo instance and query filled out
  const params = new URLSearchParams(window.location.search);
  const queryString = params.toString();

  // ${...} will be replaced by Perses, it is not a JavaScript template string
  return '/observe/traces/${traceId}?' + queryString;
}

export function linkToSpan() {
  // by capturing the entire URL search params, we can provide a breadcrumb to the previous page with the Tempo instance and query filled out
  const params = new URLSearchParams(window.location.search);
  params.set('selectSpan', 'SPANID');

  // add ${...} syntax after the URL is URL-encoded, because the characters ${} must not be URL-encoded
  const queryString = params.toString().replace('SPANID', '${spanId}');

  // ${...} will be replaced by Perses, it is not a JavaScript template string
  return '/observe/traces/${traceId}?' + queryString;
}

// ${...} will be replaced by Perses, it is not a JavaScript template string
export const spanAttributeLinks = [
  {
    name: 'k8s.namespace.name',
    link: '/k8s/cluster/namespaces/${k8s_namespace_name:percentencode}',
  },
  { name: 'k8s.node.name', link: '/k8s/cluster/nodes/${k8s_node_name:percentencode}' },
  {
    name: 'k8s.deployment.name',
    link: '/k8s/ns/${k8s_namespace_name:percentencode}/deployments/${k8s_deployment_name:percentencode}',
  },
  {
    name: 'k8s.pod.name',
    link: '/k8s/ns/${k8s_namespace_name:percentencode}/pods/${k8s_pod_name:percentencode}',
  },
];
