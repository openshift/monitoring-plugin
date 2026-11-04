# Backend metrics

The backend serves Prometheus metrics at `/metrics` on its HTTPS listener.
Go and process metrics are available regardless of the `alert-management-api`
feature.

Authentication and authorization follow the [OpenShift metrics conventions](https://github.com/openshift/enhancements/blob/master/CONVENTIONS.md#handling-kube-apiserver-disruption).
The endpoint authorizes `system:serviceaccount:openshift-monitoring:prometheus-k8s`
using the client CA configured below. Other plugin routes, including `/health`,
continue to accept connections without a client certificate.

## Operator integration

The deploying operator must configure the following independently of the alert
management feature:

- HTTPS with the plugin's serving certificate and key.
- A service account Role and RoleBinding in `openshift-monitoring` allowing
  `get`, `list`, and `watch` on the `metrics-client-ca` ConfigMap, whose
  `client-ca.crt` key contains the client CA bundle. The watcher uses a name
  field selector, allowing RBAC to restrict access with `resourceNames`.
- A ServiceMonitor using the `tls-client-certificate-auth` scrape class and
  validating the plugin's serving certificate. CMO's scrape class supplies the
  Prometheus certificate from `openshift-monitoring/metrics-client-certs`.

## E2E testing

The metrics E2E tests require an HTTPS `PLUGIN_URL` and a kubeconfig that can read
`openshift-monitoring/metrics-client-certs`. They use its `tls.crt` and `tls.key`
for scrapes. As with the existing test framework, serving certificate validation
is disabled for local port forwarding and test certificates.

Run `make test-e2e` against that backend. A CI runner that starts the backend
over plain HTTP must enable TLS and update `PLUGIN_URL` before running this
suite.
