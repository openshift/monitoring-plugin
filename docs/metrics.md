# Backend metrics

The backend serves Prometheus metrics at `/metrics` on its HTTPS listener.
Go and process metrics are available regardless of the `alert-management-api`
feature. With that feature enabled, the endpoint also exposes cleanup metrics
and the effective and dropped alert timestamp metrics described below.

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

When alert management is enabled, the plugin service account also needs `get`,
`create`, and `update` on coordination API Leases in `openshift-monitoring`.
The alert collector uses the `monitoring-plugin-metrics` Lease so only the
leader emits both alert metric families. Lease election tolerates API disruption
using the OpenShift timing defaults, and replicas rejoin after losing a lease.
General and cleanup metrics remain available on every replica, but the orphan
cleanup itself runs only on the lease holder so replicas do not double-count
cleanup work; if the Lease cannot be read, every replica keeps cleaning up. A
new leadership term starts with an empty alert snapshot, and fetches from
previous terms are ignored. Each source's snapshot expires one configured
refresh interval (30 seconds by default) after its refresh starts. If
user-workload retrieval fails, its previous series remain available only until
that limit; platform series continue to refresh. Slow fetches cannot extend
freshness. If alert-metric
initialization fails, the server logs the failure and continues serving its
other endpoints, including the independently registered cleanup metrics.

## Alert management metrics

`alerts_effective_active_at_timestamp_seconds` contains each alert that survives
ARC relabeling. Its value is the earliest active timestamp in Unix seconds,
with labels after relabeling, classification labels, and `alertstate`.
Alerts whose effective labels and state
are identical produce one series with the earliest timestamp. Overlapping backends
are deduplicated with Alertmanager preferred over Prometheus and Thanos;
Thanos-only user-workload alerts are retained. Alerts without an active
timestamp are excluded.

Its `alertstate` label can be `firing`, `pending`, or `silenced`.

`alerts_dropped_active_at_timestamp_seconds` separately exposes platform
instances rejected by an AlertRelabelConfig while they remain active or pending
in Prometheus, even after they disappear from Alertmanager. Its `alertstate`
label retains the original `pending` or `firing` state. The value is the original
`activeAt` timestamp, and labels include changes made before the rejecting
relabel rule. Dropped instances never appear in the effective metric. Once
Prometheus no longer reports the instance, its dropped series is removed.
Disabled rules with no active instance produce no series. If Prometheus cannot
be read, no dropped series is emitted from Alertmanager alone. The alerts API
continues to omit rejected instances.

To match Alertmanager timestamps to Prometheus `activeAt`, the plugin reads
Prometheus's `/api/v1/status/config` endpoint and applies its external labels
and alert relabeling rules to the matching key. The plugin's service account
must be allowed to read that endpoint. Parsed configurations and failures are
cached per backend for 30 seconds, and configuration requests have a
one-second timeout. If
configuration cannot be read, only exact label matches are enriched until the
next refresh; unmatched alerts retain Alertmanager's `startsAt`.

Separate alerts and configuration requests can reach different Prometheus
replicas. Any external label learned only from configuration, including
`cluster` and `prometheus_replica`, is treated as ambiguous unless relabeling
discards it before reading or copying its value. Labels supplied directly by
the alert remain usable for matching. Both matching and ARC evaluation use
captured upstream labels so plugin metadata cannot change delivery decisions
or hide genuine upstream values under the reserved source/backend names.

Prometheus sends its firing timestamp as Alertmanager's `startsAt`; `activeAt`
also includes the pending period. Only firing Prometheus instances can enrich
Alertmanager timestamps. If a matching instance's `activeAt` is later than
`startsAt`, the plugin retains `startsAt`: a new occurrence and clock skew are
both possible. Pending instances never overwrite an older firing occurrence.
Timestamp matching leaves the returned alert labels unchanged.

Cleanup exposes these additional metrics:

- `monitoring_plugin_alert_relabel_config_gc_list_total`: all cleanup list
  attempts, including failures.
- `monitoring_plugin_alert_relabel_config_gc_list_errors_total`: failed cleanup
  list operations.
- `monitoring_plugin_alert_relabel_config_gc_delete_total`: all orphan deletion
  attempts, including failures.
- `monitoring_plugin_alert_relabel_config_gc_delete_errors_total`: failed
  deletions of orphaned configurations.
- `monitoring_plugin_alert_relabel_config_gitops_orphans`: GitOps-managed
  configurations whose associated rule is absent. They require manual cleanup.

The cleanup feature logs errors and GitOps warnings even when these metrics are
not scraped. Non-GitOps orphans are marked with
`monitoring.openshift.io/orphaned-since` and retained for at least 15 minutes.
When the associated rule returns, the marker is cleared. A scheduled retry
ensures cleanup continues even if no more rule events arrive.

CMO will supply the corresponding alerting rules; this repository does not
install them.

## E2E testing

The metrics E2E tests require a kubeconfig that can read
`openshift-monitoring/metrics-client-certs` and create routes in
`openshift-monitoring`. They use the secret's `tls.crt` and `tls.key` for
scrapes. `PLUGIN_URL` usually points at a reencrypt route, which terminates
TLS at the router and cannot forward the scrape client certificate, so the
tests create their own passthrough route to the plugin service and scrape
through it. As with the existing test framework, serving certificate
validation is disabled for that route and its certificates.

Run `make test-e2e` against that backend. A CI runner that starts the backend
over plain HTTP must enable TLS and update `PLUGIN_URL` before running this
suite.

Effective-alert and cleanup tests also require `alert-management-api` enabled.
The leader-election test additionally reads the plugin deployment, pods, and
the `monitoring-plugin-metrics` Lease, and scales the deployment to two
replicas when the cluster runs fewer, restoring the original count afterwards.
The orphan cleanup test verifies the initial marker, then ages it to exercise
deletion without waiting 15 minutes.
