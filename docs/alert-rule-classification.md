# Alert Rule Classification - Design and Usage

## Overview
The backend classifies Prometheus alerting rules into a “component” and an “impact layer”. It:
- Computes an `openshift_io_alert_rule_id` per alerting rule.
- Determines component/layer based on matcher logic and rule labels.
- Allows users to override classification via a single, fixed-name ConfigMap per namespace.
- Enriches the Alerts API response with `openshift_io_alert_rule_id`, `openshift_io_alert_component`, and `openshift_io_alert_layer`.

This document explains how it works, how to override, and how to test it.


## Terminology
- openshift_io_alert_rule_id: Identifier for an alerting rule. Computed from a canonicalized view of the rule definition and encoded as `rid_` + base64url(nopad(sha256(payload))). Independent of `PrometheusRule` name.
- component: Logical owner of the alert (e.g., `kube-apiserver`, `etcd`, a namespace, etc.).
- layer: Impact scope. Allowed values:
  - `cluster`
  - `namespace`

Notes:
- **Stability**:
  - The id is **always derived from the rule spec**. If the rule definition changes (expr/for/business labels/name), the id may change.
  - For **platform rules**, this API currently only supports label updates via `AlertRelabelConfig` (not editing expr/for), so the id is effectively stable unless the upstream operator changes the rule definition.
  - For **user-defined rules**, the API stamps the computed id into the `PrometheusRule` rule labels. If you update the rule definition, the API returns the **new** id and migrates any existing classification override to the new id.
- Layer values are validated as `cluster|namespace` when set. To remove an override, clear the field (via API `null` or by removing the ConfigMap entry); empty/invalid values are ignored at read time.

## Rule ID computation (openshift_io_alert_rule_id)
Location: `pkg/alert_rule/alert_rule.go`

The backend computes a specHash-like value from:
- `kind`/`name`: `alert` + `alert:` name or `record` + `record:` name
- `expr`: trimmed with consecutive whitespace collapsed
- `for`: trimmed (duration string as written in the rule)
- `labels`: only non-system labels
  - excludes labels with `openshift_io_` prefix and the `alertname` label
  - drops empty values
  - keeps only valid Prometheus label names (`[a-zA-Z_][a-zA-Z0-9_]*`)
  - sorted by key and joined as `key=value` lines

Annotations are intentionally ignored to reduce id churn on documentation-only changes.

## Classification Logic (How component/layer are determined)
Location: `pkg/alertcomponent/matcher.go`

1) The code adapts `cluster-health-analyzer` matchers:
   - CVO-related alerts (update/upgrade) → component/layer based on known patterns
   - Compute / node-related alerts
   - Core control plane components (renamed to layer `cluster`)
   - Workload/namespace-level alerts (renamed to layer `namespace`)

2) Fallback:
   - If the computed component is empty or “Others”, we set:
     - `component = other`
     - `layer` derived from source:
       - `openshift_io_alert_source=platform` → `cluster`
       - `openshift_io_prometheus_rule_namespace=openshift-monitoring` → `cluster`
       - `prometheus` label starting with `openshift-monitoring/` → `cluster`
       - otherwise → `namespace`

3) Result:
   - Each alerting rule is assigned a `(component, layer)` tuple following the above logic.

## Developer Overrides via Rule Labels (Recommended)
If you want explicit component/layer values and do not want to rely on the matcher, set
these labels on each rule in your `PrometheusRule`:
- `openshift_io_alert_rule_component`
- `openshift_io_alert_rule_layer`

Both are validated the same way as API overrides:
- `component`: 1-253 chars, alphanumeric + `._-`, must start/end alphanumeric
- `layer`: `cluster` or `namespace`

When these labels are present and valid, they override matcher-derived values.

## User Overrides (ConfigMap)
Location: `pkg/management/update_classification.go`, `pkg/management/get_alerts.go`

- The backend stores overrides in the plugin namespace, sharded by target rule namespace:
  - Name: `alert-classification-overrides-<rule-namespace>`
  - Namespace: the monitoring plugin's namespace
  - Required label:
    - `monitoring.openshift.io/type=alert-classification-overrides`
  - Recommended label:
    - `app.kubernetes.io/managed-by=openshift-console`

- Data layout:
  - Key: base64url(nopad(UTF-8 bytes of `<openshift_io_alert_rule_id>`))
    - This keeps ConfigMap keys opaque and avoids relying on any particular id character set.
  - Value: JSON object with a `classification` field that holds component/layer.
    - Optional metadata fields such as `alertName`, `prometheusRuleName`, and
      `prometheusRuleNamespace` may be included for readability; they are ignored by
      the backend.
  - Dynamic overrides:
    - `openshift_io_alert_rule_component_from`: derive component from an alert label key.
    - `openshift_io_alert_rule_layer_from`: derive layer from an alert label key.

Example:
```json
{
  "alertName": "ClusterOperatorDown",
  "prometheusRuleName": "cluster-version",
  "prometheusRuleNamespace": "openshift-cluster-version",
  "classification": {
    "openshift_io_alert_rule_component_from": "name",
    "openshift_io_alert_rule_layer": "cluster"
  }
}
```

Notes:
- Overrides are only read when the required `monitoring.openshift.io/type` label is present.
- Invalid component/layer values are ignored for that entry.
- `*_from` values must be valid Prometheus label names (`[a-zA-Z_][a-zA-Z0-9_]*`).
- If a `*_from` label is present but the alert does not carry that label or the derived
  value is invalid, the backend falls back to static values (if present) or defaults.
- If both component and layer are empty, the entry is removed.


## Alerts API Enrichment
Location: `pkg/management/get_alerts.go`, `pkg/k8s/prometheus_alerts.go`

- Endpoint: `GET /api/v1/alerting/alerts` (prom-compatible schema)
- The backend fetches active alerts and enriches each alert with:
  - `openshift_io_alert_rule_id`
  - `openshift_io_alert_component`
  - `openshift_io_alert_layer`
  - `prometheusRuleName`: name of the PrometheusRule resource the alert originates from
  - `prometheusRuleNamespace`: namespace of that PrometheusRule resource
  - `alertingRuleName`: name of the AlertingRule CR that generated the PrometheusRule (empty when the PrometheusRule is not owned by an AlertingRule CR)
- Prometheus compatibility:
  - Base response matches Prometheus `/api/v1/alerts`.
  - Additional fields are additive and safe for clients like Perses.

## Prometheus/Thanos Sources
Location: `pkg/k8s/prometheus_alerts.go`

- Order of candidates:
  1) Thanos Route `thanos-querier` at `/api` + `/v1/alerts` (oauth-proxied)
  2) In-cluster Thanos service `https://thanos-querier.openshift-monitoring.svc:9091/api/v1/alerts`
  3) In-cluster Prometheus `https://prometheus-k8s.openshift-monitoring.svc:9091/api/v1/alerts`
  4) In-cluster Prometheus (plain HTTP) `http://prometheus-k8s.openshift-monitoring.svc:9090/api/v1/alerts` (fallback)
  5) Prometheus Route `prometheus-k8s` at `/api/v1/alerts`

- TLS and Auth:
  - Bearer token: service account token from in-cluster config.
  - CA trust: system pool + `SSL_CERT_FILE` + `/var/run/configmaps/service-ca/service-ca.crt`.

RBAC:
- Read routes in `openshift-monitoring`.
- Access `prometheuses/api` as needed for oauth-proxied endpoints.

## Updating Rules Classification
APIs:
- Single update:
  - Method: `PATCH /api/v1/alerting/rules/{ruleId}`
  - Request body:
    ```json
    {
      "classification": {
        "openshift_io_alert_rule_component": "team-x",
        "openshift_io_alert_rule_layer": "namespace",
        "openshift_io_alert_rule_component_from": "name",
        "openshift_io_alert_rule_layer_from": "layer"
      }
    }
    ```
    - `openshift_io_alert_rule_layer`: `cluster` or `namespace`
    - To remove a classification override, set the field to `null` (e.g. `"openshift_io_alert_rule_layer": null`).
  - Response:
    - 200 OK with a status payload (same format as other rule PATCH responses), where `status_code` is 204 on success.
    - Standard error body on failure (400 validation, 404 not found, etc.)
- Bulk update:
  - Method: `PATCH /api/v1/alerting/rules`
  - Request body:
    ```json
    {
      "ruleIds": ["<id-a>", "<id-b>"],
      "classification": {
        "openshift_io_alert_rule_component": "etcd",
        "openshift_io_alert_rule_layer": "cluster"
      }
    }
    ```
  - Response:
    - 200 OK with per-rule results (same format as other bulk rule PATCH responses). Clients should handle partial failures.

Direct K8s (supported for power users/GitOps):
- PATCH/PUT the ConfigMap `alert-classification-overrides-<rule-namespace>` in the monitoring plugin namespace (respect `resourceVersion`).
- Each entry is keyed by base64url(`<openshift_io_alert_rule_id>`) with a JSON payload that contains a `classification` object (`openshift_io_alert_rule_component`, `openshift_io_alert_rule_layer`).
- UI should check update permissions with SelfSubjectAccessReview before showing an editor.

Notes:
- These endpoints are intended for updating **classification only** (component/layer overrides),
  with permissions enforced based on the rule’s ownership (platform, user workload, operator-managed,
  GitOps-managed).
- To update other rule fields (expr/labels/annotations/etc.), use `PATCH /api/v1/alerting/rules/{ruleId}`.
  Clients that need to update both should issue two requests. The combined operation is not atomic.
- In the ConfigMap override entries, classification is nested under `classification`
  and validated as component/layer to keep it separate from generic label updates.

## Security Notes
- Persist only minimal classification metadata in the fixed-name ConfigMap.

## Testing and Ops
Unit tests:
- `pkg/management/get_alerts_test.go`
  - Overrides from labeled ConfigMap, fallback behavior, label validation.

## Future Work
- Optional CRD to formalize the schema (adds overhead; ConfigMap is sufficient today).
- Optional composite update API if we need to update rule fields and classification atomically.
- De-duplication/merge logic when aggregating alerts across sources.

