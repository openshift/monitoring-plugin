## Alert Management Notes

This document covers alert management behavior and prerequisites for the monitoring plugin.

### User workload monitoring prerequisites

To include **user workload** alerts and rules in `/api/v1/alerting/alerts` and `/api/v1/alerting/rules`, the user workload monitoring stack must be enabled. Follow the OpenShift documentation for enabling and configuring UWM:

https://docs.redhat.com/en/documentation/monitoring_stack_for_red_hat_openshift/4.20/html/configuring_user_workload_monitoring/configuring-alerts-and-notifications-uwm

#### How the plugin reads user workload alerts/rules

The plugin prefers **Thanos tenancy** for user workload alerts/rules (RBAC-scoped, requires a namespace parameter). When the client does not provide a `namespace` filter, the plugin discovers candidate namespaces and queries Thanos tenancy per-namespace, using the end-user bearer token.

Routes in `openshift-user-workload-monitoring` are treated as **fallbacks** (and are also used for some health checks and pending state retrieval).

If you want to create the user workload Prometheus route (optional), you can expose the service:

```shell
oc -n openshift-user-workload-monitoring expose svc/prometheus-user-workload-web --name=prometheus-user-workload-web --port=web
```

If the route is missing/unreachable but tenancy is healthy, the plugin should still return user workload data and suppress route warnings.

#### Alert states

- `/api/v1/alerting/alerts?state=pending`: pending alerts come from Prometheus.
- `/api/v1/alerting/alerts?state=firing`: firing alerts come from Alertmanager when available.
- `/api/v1/alerting/alerts?state=silenced`: silenced alerts come from Alertmanager (requires an Alertmanager endpoint).

### Alertmanager routing choices

OpenShift supports routing user workload alerts to:

- The **platform Alertmanager** (default instance)
- A **separate Alertmanager** for user workloads
- **External Alertmanager** instances

This is a cluster configuration choice and does not change the plugin API shape. The plugin reads alerts from Alertmanager (for firing/silenced) and Prometheus (for pending), then merges platform and user workload results when available.

The plugin intentionally reads from only the in-cluster Alertmanager endpoints. Supporting multiple external Alertmanagers would introduce ambiguous alert state and silencing outcomes because each instance can apply different routing, inhibition, and silence configurations.

### Managing user-defined alert rules

| Rule ownership | Editable? | Classification? | Drop/Restore? |
|---|---|---|---|
| User-owned | Yes (direct PR mutation) | Yes (set labels directly) | No (ARC not supported) |
| Operator-managed | No (reconciled) | No | No |
| GitOps-managed | No (reconciled) | No | No |

**User-owned** rules can be fully edited (labels, severity, expr, annotations)
via the update API, which mutates the PrometheusRule directly.

**Operator-managed** and **GitOps-managed** user-defined rules cannot be edited
because the owning controller would reconcile the change. These alerts can only
be **silenced** via Alertmanager silences.

ARC-based operations (classification overrides, drop/restore) are not available
for any user-defined rule because the user workload stack does not process
AlertRelabelConfigs. If this capability is needed, open an RFE against CMO.
