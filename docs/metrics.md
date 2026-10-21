# Backend metrics

The backend serves Prometheus metrics at `/metrics` on its HTTPS listener.
Go and process metrics are available regardless of the `alert-management-api`
feature. With that feature enabled, the endpoint also exposes cleanup metrics
and `alerts_effective_active_at_timestamp_seconds`.

## Authentication and authorization

Scrapes require a client certificate signed by the CA bundle in
`openshift-monitoring/metrics-client-ca`, key `client-ca.crt`. CMO maintains this
bundle from the API server's client CA bundle. The plugin watches it for changes.
Until the first valid bundle loads, certificate-authenticated scrapes return 503.
After it loads, verification uses the cached bundle and does not call the API
server during a scrape.

Only the certificate identity
`system:serviceaccount:openshift-monitoring:prometheus-k8s` is authorized. Missing
or invalid certificates receive 401; other authenticated identities receive 403.
Bearer tokens and forwarded identity headers do not authorize a scrape. Other
plugin routes, including `/health`, continue to accept connections without a
client certificate.

This follows the [OpenShift metrics authentication conventions](https://github.com/openshift/enhancements/blob/master/CONVENTIONS.md#handling-kube-apiserver-disruption).

## Operator integration

The deploying operator must configure the following independently of the alert
management feature:

- HTTPS with the plugin's serving certificate and key.
- A service account Role and RoleBinding in `openshift-monitoring` allowing
  `get`, `list`, and `watch` on the `metrics-client-ca` ConfigMap. The watcher uses
  a name field selector, allowing RBAC to restrict access with `resourceNames`.
- A ServiceMonitor using the `tls-client-certificate-auth` scrape class and
  validating the plugin's serving certificate. CMO's scrape class supplies the
  Prometheus certificate from `openshift-monitoring/metrics-client-certs`.

When alert management is enabled, the plugin service account also needs `get`,
`create`, and `update` on coordination API Leases in `openshift-monitoring`.
The effective-alert collector uses the `monitoring-plugin-metrics` Lease so
only the leader emits those series. Lease election tolerates API disruption
using the OpenShift timing defaults, and replicas rejoin after losing a lease.
General and cleanup metrics remain available on every replica.

## Alert management metrics

`alerts_effective_active_at_timestamp_seconds` contains each effective alert's
earliest active timestamp, in Unix seconds, with its labels after relabeling,
classification labels, and `alertstate`. Alerts whose effective labels and state
are identical produce one series with the earliest timestamp. Thanos-sourced
duplicates and alerts without an active timestamp are excluded.

Cleanup exposes these additional metrics:

- `monitoring_plugin_alert_relabel_config_gc_list_errors_total`: failed cleanup
  list operations.
- `monitoring_plugin_alert_relabel_config_gc_delete_errors_total`: failed
  deletions of orphaned configurations.
- `monitoring_plugin_alert_relabel_config_gitops_orphans`: GitOps-managed
  configurations whose associated rule is absent. They require manual cleanup.

The cleanup feature logs errors and GitOps warnings even when these metrics are
not scraped. Non-GitOps orphans are marked with
`monitoring.openshift.io/orphaned-since` and retained for at least 15 minutes.
When the associated rule returns, the marker is cleared. A scheduled retry
ensures cleanup continues even if no more rule events arrive.

CMO must supply the corresponding alerting rules; this repository does not
install them.

## E2E testing

The metrics E2E tests require an HTTPS `PLUGIN_URL`, a backend with
`alert-management-api` enabled, and a kubeconfig that can read
`openshift-monitoring/metrics-client-certs`. They use its `tls.crt` and `tls.key`
for scrapes. As with the existing test framework, serving certificate validation
is disabled for local port forwarding and test certificates.

Run `make test-e2e` against that backend. A CI runner that starts the backend
over plain HTTP must enable TLS and update `PLUGIN_URL` before running this
suite. The orphan cleanup test verifies the initial marker, then ages it to
exercise deletion without waiting 15 minutes.
