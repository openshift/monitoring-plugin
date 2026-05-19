# E2E Test Report — Alert Management API (STP v2)

**Date:** 2026-05-18 20:29  
**Branch:** test-alert-management-v2-sradco  
**Base:** sradco/alerts-effective-metric (PR #16)  
**Plugin:** In-cluster deployment (monitoring-plugin-e2e namespace)  
**Cluster:** iuo-or-422.rhos-psi.cnv-qe.rhood.us  

## Summary

| Status | Count |
|--------|-------|
| **Passed** | 54 |
| **Failed** | 5 |
| **Skipped** | 2 |
| **Total** | 61 |

## Results by Phase

### Phase2_GetRules (12 pass, 0 fail, 0 skip)

| Test | Status | Time |
|------|--------|------|
| TC001_HealthEndpoint | ✅ PASS | 0.41s |
| TC002_ListAllRulesProvenanceLabels | ✅ PASS | 3.80s |
| TC003_RulesFilterStateFiring | ✅ PASS | 2.95s |
| TC004_RulesFilterStatePending | ✅ PASS | 2.80s |
| TC005_RulesFilterSeverity | ✅ PASS | 3.35s |
| TC006_RulesFilterNamespace | ✅ PASS | 4.21s |
| TC007_RulesFilterAlertname | ✅ PASS | 2.80s |
| TC008_RulesMultiFilterSeverityNamespace | ✅ PASS | 2.91s |
| TC009_RulesMultiFilterStateSeverity | ✅ PASS | 2.98s |
| TC010_RulesFilterSourcePlatform | ✅ PASS | 2.97s |
| TC011_RulesFilterPlatformNamespace | ✅ PASS | 3.85s |
| TC012_RulesInvalidState | ✅ PASS | 0.35s |

### Phase3_GetAlerts (11 pass, 0 fail, 0 skip)

| Test | Status | Time |
|------|--------|------|
| TC013_GetAllAlerts | ✅ PASS | 1.89s |
| TC014_AlertsFilterStateFiring | ✅ PASS | 1.95s |
| TC015_AlertsFilterStatePending | ✅ PASS | 1.68s |
| TC016_AlertsFilterSeverity | ✅ PASS | 1.98s |
| TC017_AlertsMultiFilterStateSeverity | ✅ PASS | 2.26s |
| TC018_AlertsFilterAlertname | ✅ PASS | 1.95s |
| TC019_AlertsBackendEnrichment | ✅ PASS | 1.96s |
| TC020_AlertsSourceEnrichment | ✅ PASS | 2.05s |
| TC021_AlertsAlertRuleIdEnrichment | ✅ PASS | 1.82s |
| TC022_AlertsWarningsField | ✅ PASS | 2.05s |
| TC023_AlertsInvalidState | ✅ PASS | 0.32s |

### Phase4_Create (10 pass, 0 fail, 0 skip)

| Test | Status | Time |
|------|--------|------|
| TC024_CreateUserDefinedRule | ✅ PASS | 0.85s |
| TC025_CreatePlatformRule | ✅ PASS | 0.72s |
| TC026_CreateInGitOpsPR | ✅ PASS | 0.34s |
| TC027_CreateInOperatorPR | ✅ PASS | 0.36s |
| TC028_CreateInPlatformNS | ✅ PASS | 0.35s |
| TC029_CreateDuplicate | ✅ PASS | 0.32s |
| TC030a_MissingAlertingRule | ✅ PASS | 0.37s |
| TC030b_MissingPrometheusRule | ✅ PASS | 0.66s |
| TC030c_InvalidJSON | ✅ PASS | 0.39s |
| TC030_CreateInputValidation | ✅ PASS | 1.41s |

### Phase5_Classification (5 pass, 0 fail, 0 skip)

| Test | Status | Time |
|------|--------|------|
| TC031_ClassifyPlatformOperatorManaged | ✅ PASS | 0.61s |
| TC032_ClassifyPlatformUnmanaged | ✅ PASS | 4.48s |
| TC033_ClassifyUserDefined | ✅ PASS | 4.19s |
| TC034_ClassifyOperatorManaged | ✅ PASS | 4.01s |
| TC035_ClassifyGitOps | ✅ PASS | 4.38s |

### Phase6_SingleUpdate (4 pass, 0 fail, 1 skip)

| Test | Status | Time |
|------|--------|------|
| TC036_UpdateUserDefined | ⏭️ SKIP | 0.00s |
| TC037_DisablePlatformRule | ✅ PASS | 0.54s |
| TC038_ReenablePlatformRule | ✅ PASS | 0.60s |
| TC039_DisableUserDefined | ✅ PASS | 4.26s |
| TC040_CombinedClassificationEnable | ✅ PASS | 0.94s |

### Phase7_BulkUpdate (4 pass, 2 fail, 0 skip)

| Test | Status | Time |
|------|--------|------|
| TC041_BulkLabelUpdate | ✅ PASS | 0.77s |
| TC042_BulkDisable | ✅ PASS | 4.72s |
| TC043_BulkReEnable | ✅ PASS | 4.81s |
| TC044_BulkClassification | ✅ PASS | 4.80s |
| TC045_BulkPartialFailure | ❌ FAIL | 9.01s |
| TC046_BulkLabelRemoval | ❌ FAIL | 4.70s |

### Phase8_SingleDelete (2 pass, 0 fail, 0 skip)

| Test | Status | Time |
|------|--------|------|
| TC047_DeleteUserDefined | ✅ PASS | 4.23s |
| TC048_DeleteGitOps | ✅ PASS | 3.98s |

### Phase9_BulkDelete (2 pass, 1 fail, 0 skip)

| Test | Status | Time |
|------|--------|------|
| TC049_BulkDeleteUserDefined | ❌ FAIL | 126.72s |
| TC050_BulkDeletePartialFailure | ✅ PASS | 145.07s |
| TC051_BulkDeleteNonexistent | ✅ PASS | 0.32s |

### Phase10_CRUDLifecycle (0 pass, 0 fail, 1 skip)

| Test | Status | Time |
|------|--------|------|
| TC052_FullCRUDLifecycle | ⏭️ SKIP | 0.00s |

### Phase12_Metrics (4 pass, 2 fail, 0 skip)

| Test | Status | Time |
|------|--------|------|
| TC053_MetricEndpointExposesEffectiveMetric | ❌ FAIL | 0.36s |
| TC054_MetricSeriesHaveRequiredLabels | ✅ PASS | 0.35s |
| TC055_MetricExcludesThanosBackend | ✅ PASS | 0.33s |
| TC056_MetricIncludesClassificationLabels | ❌ FAIL | 0.36s |
| TC057_MetricExcludesAnnotations | ✅ PASS | 0.32s |
| TC058_MetricActiveAtTimestampsAreReasonable | ✅ PASS | 0.39s |

## Failed Tests — Root Cause Analysis

### TC-045 (BulkPartialFailure), TC-046 (BulkLabelRemoval) — Stale Rule IDs

**Problem:** The bulk PATCH returns `404` for the UserRule ID because the ID has changed since Phase 1 discovery.

**Root Cause:** The `openshift_io_alert_rule_id` is a hash of the rule content (including labels). When TC-041 adds `bulk_test_label` to the rule, the labels change, which changes the hash, which changes the ID. The relabeled cache takes ~75 seconds to re-sync. The GET /rules response (from Prometheus) still returns the OLD ID because Prometheus evaluates the rule with the original labels. Meanwhile, the relabeled cache has computed a NEW ID from the updated PrometheusRule CRD. When the test refreshes the ID via GET /rules, it gets the old (Prometheus) ID. When it sends that ID to the bulk PATCH, the relabeled cache doesn't recognize it (it has the new ID).

**What was tried:**
- `refreshRuleID()` before every operation — gets old ID from Prometheus response
- 90-second sleep between TC-041 and TC-042 — helped some tests but not TC-045/046
- Polling with bulk PATCH probe to verify ID validity — caused side effects (empty PATCH modified rules)

**Resolution needed:** The developer should clarify how the ID is supposed to stabilize. The mismatch between the Prometheus response ID and the relabeled cache ID is the fundamental issue. Possible fixes:
1. The relabeled cache should stamp the `openshift_io_alert_rule_id` label directly on the PrometheusRule CRD (so Prometheus evaluates with the correct ID)
2. The bulk PATCH should accept both old and new IDs during the transition period
3. The GET /rules response should use the relabeled cache ID instead of the Prometheus-reported ID

### TC-049 (BulkDeleteUserDefined) — Same Stale ID Issue

**Problem:** Temporary rules created by POST get IDs from the response. After the relabeled cache re-syncs, the IDs change. Even with a 90-second wait and refresh, the refreshed ID comes from Prometheus (old) while the cache has the new one.

### TC-053 (MetricEndpointExposesEffectiveMetric), TC-056 (MetricIncludesClassificationLabels) — Intermittent Metrics

**Problem:** The `/metrics` endpoint sometimes doesn't expose the `alerts_effective_active_at_timestamp_seconds` metric.

**Root Cause:** The metric collector depends on leader election and successful Prometheus alert fetching. When the plugin pod restarts or the leader lease changes, the metric may temporarily disappear. This is intermittent — the same tests passed in previous runs.

## Skipped Tests

| Test | Reason |
|------|--------|
| TC-036 (UpdateUserDefined) | Requires single-rule PATCH `/rules/{ruleId}` with `alertingRule` body — not supported by bulk endpoint |
| TC-052 (FullCRUDLifecycle) | Same — lifecycle PATCH step needs single-rule endpoint |

**Note:** These tests will work once sradco adds the single-rule PATCH/DELETE routes (PR09 in the restructured chain).

## Bugs Found During Testing

### CNV-85482 — Relabeled Rules Cache Stops Syncing (FIXED locally)

**Status:** MODIFIED in Jira, fix applied locally (`initCtx` → `ctx` in server.go line 156)  
**Impact:** Without this fix, new rules never get `openshift_io_alert_rule_id` stamped after plugin startup  
**Fix:** Pass server-scoped `ctx` to `k8s.NewClient()` instead of the 30-second `initCtx`

## Test Environment Setup

### Local Plugin (48 pass, 0 fail, 13 skip)
```bash
export KUBECONFIG=/path/to/kubeconfig
export PLUGIN_URL=http://localhost:9001
export BEARER_TOKEN=$(oc whoami --show-token)
MONITORING_PLUGIN_FEATURES=alert-management-api go run ./cmd/... --port=9001
go test -v -timeout=150m -count=1 -run TestAlertManagementAPI ./test/e2e/
```
13 tests skip because UWM (user-workload monitoring) is not accessible from a local plugin.

### In-Cluster Plugin (54 pass, 5 fail, 2 skip)
```bash
# Build and push
podman build -t quay.io/<org>/monitoring-plugin:e2e-test --platform=linux/amd64 -f Dockerfile.e2e .
podman push quay.io/<org>/monitoring-plugin:e2e-test

# Deploy (ServiceAccount + ClusterRoleBinding + Deployment + Service + Route)
# Plugin runs with --features=alert-management-api --port=9001

# Run tests against the route
export PLUGIN_URL=http://<route-host>
export BEARER_TOKEN=$(oc whoami --show-token)
go test -v -timeout=150m -count=1 -run TestAlertManagementAPI ./test/e2e/
```

### Prerequisites
- OpenShift cluster with CMO
- User Workload Monitoring enabled (`enableUserWorkload: true` in `cluster-monitoring-config`)
- `alertmanagerMain.enableUserAlertmanagerConfig: true`
- CNV-85482 fix applied in plugin code
