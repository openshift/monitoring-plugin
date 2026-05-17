# E2E Test Report — Alert Management API (STP v2)

**Date:** 2026-05-17 17:06
**Branch:** test-alert-management-v2-sradco
**Base:** sradco/alerts-effective-metric (PR #16)
**Plugin:** Local (with CNV-85482 fix applied)

## Summary

| Status | Count |
|--------|-------|
| **Passed** | 48 |
| **Failed** | 0 |
| **Skipped** | 13 |
| **Total** | 61 |

## Results by Phase

### Phase2_GetRules (12 pass, 0 fail, 0 skip)

| Test | Status | Time |
|------|--------|------|
| TC001_HealthEndpoint | ✅ PASS | 2.76s |
| TC002_ListAllRulesProvenanceLabels | ✅ PASS | 4.72s |
| TC003_RulesFilterStateFiring | ✅ PASS | 4.48s |
| TC004_RulesFilterStatePending | ✅ PASS | 4.82s |
| TC005_RulesFilterSeverity | ✅ PASS | 4.49s |
| TC006_RulesFilterNamespace | ✅ PASS | 4.27s |
| TC007_RulesFilterAlertname | ✅ PASS | 3.98s |
| TC008_RulesMultiFilterSeverityNamespace | ✅ PASS | 4.17s |
| TC009_RulesMultiFilterStateSeverity | ✅ PASS | 3.99s |
| TC010_RulesFilterSourcePlatform | ✅ PASS | 4.13s |
| TC011_RulesFilterPlatformNamespace | ✅ PASS | 4.23s |
| TC012_RulesInvalidState | ✅ PASS | 0.00s |

### Phase3_GetAlerts (11 pass, 0 fail, 0 skip)

| Test | Status | Time |
|------|--------|------|
| TC013_GetAllAlerts | ✅ PASS | 4.91s |
| TC014_AlertsFilterStateFiring | ✅ PASS | 4.97s |
| TC015_AlertsFilterStatePending | ✅ PASS | 4.89s |
| TC016_AlertsFilterSeverity | ✅ PASS | 4.83s |
| TC017_AlertsMultiFilterStateSeverity | ✅ PASS | 5.03s |
| TC018_AlertsFilterAlertname | ✅ PASS | 4.85s |
| TC019_AlertsBackendEnrichment | ✅ PASS | 5.50s |
| TC020_AlertsSourceEnrichment | ✅ PASS | 4.94s |
| TC021_AlertsAlertRuleIdEnrichment | ✅ PASS | 4.94s |
| TC022_AlertsWarningsField | ✅ PASS | 4.62s |
| TC023_AlertsInvalidState | ✅ PASS | 0.00s |

### Phase4_Create (9 pass, 0 fail, 1 skip)

| Test | Status | Time |
|------|--------|------|
| TC024_CreateUserDefinedRule | ⏭️ SKIP | 0.00s |
| TC025_CreatePlatformRule | ✅ PASS | 0.44s |
| TC026_CreateInGitOpsPR | ✅ PASS | 0.01s |
| TC027_CreateInOperatorPR | ✅ PASS | 0.00s |
| TC028_CreateInPlatformNS | ✅ PASS | 0.00s |
| TC029_CreateDuplicate | ✅ PASS | 0.00s |
| TC030a_MissingAlertingRule | ✅ PASS | 0.00s |
| TC030b_MissingPrometheusRule | ✅ PASS | 1.11s |
| TC030c_InvalidJSON | ✅ PASS | 0.00s |
| TC030_CreateInputValidation | ✅ PASS | 1.12s |

### Phase5_Classification (2 pass, 0 fail, 3 skip)

| Test | Status | Time |
|------|--------|------|
| TC031_ClassifyPlatformOperatorManaged | ✅ PASS | 0.80s |
| TC032_ClassifyPlatformUnmanaged | ✅ PASS | 0.60s |
| TC033_ClassifyUserDefined | ⏭️ SKIP | 0.00s |
| TC034_ClassifyOperatorManaged | ⏭️ SKIP | 0.00s |
| TC035_ClassifyGitOps | ⏭️ SKIP | 0.00s |

### Phase6_SingleUpdate (3 pass, 0 fail, 2 skip)

| Test | Status | Time |
|------|--------|------|
| TC036_UpdateUserDefined | ⏭️ SKIP | 0.00s |
| TC037_DisablePlatformRule | ✅ PASS | 0.70s |
| TC038_ReenablePlatformRule | ✅ PASS | 0.61s |
| TC039_DisableUserDefined | ⏭️ SKIP | 0.00s |
| TC040_CombinedClassificationEnable | ✅ PASS | 1.19s |

### Phase7_BulkUpdate (3 pass, 0 fail, 3 skip)

| Test | Status | Time |
|------|--------|------|
| TC041_BulkLabelUpdate | ✅ PASS | 1.20s |
| TC042_BulkDisable | ✅ PASS | 1.43s |
| TC043_BulkReEnable | ✅ PASS | 1.20s |
| TC044_BulkClassification | ⏭️ SKIP | 0.00s |
| TC045_BulkPartialFailure | ⏭️ SKIP | 0.00s |
| TC046_BulkLabelRemoval | ⏭️ SKIP | 0.00s |

### Phase8_SingleDelete (1 pass, 0 fail, 1 skip)

| Test | Status | Time |
|------|--------|------|
| TC047_DeleteUserDefined | ⏭️ SKIP | 0.00s |
| TC048_DeleteGitOps | ✅ PASS | 0.00s |

### Phase9_BulkDelete (1 pass, 0 fail, 2 skip)

| Test | Status | Time |
|------|--------|------|
| TC049_BulkDeleteUserDefined | ⏭️ SKIP | 0.00s |
| TC050_BulkDeletePartialFailure | ⏭️ SKIP | 0.00s |
| TC051_BulkDeleteNonexistent | ✅ PASS | 0.00s |

### Phase10_CRUDLifecycle (0 pass, 0 fail, 1 skip)

| Test | Status | Time |
|------|--------|------|
| TC052_FullCRUDLifecycle | ⏭️ SKIP | 0.00s |

### Phase12_Metrics (6 pass, 0 fail, 0 skip)

| Test | Status | Time |
|------|--------|------|
| TC053_MetricEndpointExposesEffectiveMetric | ✅ PASS | 0.00s |
| TC054_MetricSeriesHaveRequiredLabels | ✅ PASS | 0.00s |
| TC055_MetricExcludesThanosBackend | ✅ PASS | 0.00s |
| TC056_MetricIncludesClassificationLabels | ✅ PASS | 0.00s |
| TC057_MetricExcludesAnnotations | ✅ PASS | 0.00s |
| TC058_MetricActiveAtTimestampsAreReasonable | ✅ PASS | 0.00s |

## Skipped Tests

| Test | Reason |
|------|--------|
| TC024_CreateUserDefinedRule |  |
| TC033_ClassifyUserDefined |  |
| TC034_ClassifyOperatorManaged |  |
| TC035_ClassifyGitOps |  |
| TC036_UpdateUserDefined |  |
| TC039_DisableUserDefined |  |
| TC044_BulkClassification |  |
| TC045_BulkPartialFailure |  |
| TC046_BulkLabelRemoval |  |
| TC047_DeleteUserDefined |  |
| TC049_BulkDeleteUserDefined |  |
| TC050_BulkDeletePartialFailure |  |
| TC052_FullCRUDLifecycle |  |

## Environment

- **Cluster:** iuo-or-422.rhos-psi.cnv-qe.rhood.us
- **Auth:** Bearer token (cert-based kubeconfig + token)
- **Plugin:** Running locally with `alert-management-api` feature
- **CNV-85482 fix:** Applied locally (`initCtx` → `ctx` in server.go)
- **UWM:** Not accessible from local plugin (12 tests skipped)
