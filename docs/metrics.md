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
- Mount the `openshift-monitoring/metrics-client-ca` ConfigMap at
  `/etc/tls/client` and set `--client-ca-file=/etc/tls/client/client-ca.crt`.
  The backend reloads the mounted CA bundle when it rotates; no additional
  Kubernetes API permissions are needed for metrics authentication.
- A ServiceMonitor using the `tls-client-certificate-auth` scrape class and
  validating the plugin's serving certificate. CMO's scrape class supplies the
  Prometheus certificate from `openshift-monitoring/metrics-client-certs`.

## Development and testing

When TLS is disabled for local development, `/metrics` is available without
client certificate authorization. HTTPS deployments always verify the client
certificate.

Backend unit tests cover certificate authorization, client CA rotation, and
metrics availability without the alert management feature. End-to-end coverage
belongs in CMO, where the deployed ServiceMonitor and Prometheus scrape client
certificate are configured together.
