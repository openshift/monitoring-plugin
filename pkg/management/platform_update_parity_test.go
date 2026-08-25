package management_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

type platformParityFixture struct {
	name         string
	relabeled    monitoringv1.Rule
	ruleID       string
	wantWritable bool
	wantManaged  management.ManagementSource
	setup        func(*testing.T, *testutils.MockClient)
	preview      management.PreviewUpdateRequest
	execute      func(management.Client) error
}

func TestPlatformUpdatePreviewExecuteWritableParity(t *testing.T) {
	info := "info"
	component := "networking"
	critical := "critical"

	fixtures := []platformParityFixture{
		{
			name:         "gitops_relabeled_rule_blocks_label_update",
			relabeled:    copyRuleWithLabels(upPlatformRule, managementlabels.RuleManagedByLabel, managementlabels.ManagedByGitOps),
			ruleID:       upPlatformRuleId,
			wantWritable: false,
			wantManaged:  management.ManagedByGitOps,
			setup: func(t *testing.T, mockK8s *testutils.MockClient) {
				setupPreviewPlatformMocks(t, mockK8s, false)
			},
			preview: management.PreviewUpdateRequest{
				RuleID: upPlatformRuleId,
				Labels: map[string]*string{"severity": &info},
			},
			execute: func(client management.Client) error {
				updated := copyRule(upOriginalPlatformRule)
				updated.Labels["severity"] = "info"
				return client.UpdatePlatformAlertRule(context.Background(), upPlatformRuleId, updated)
			},
		},
		{
			name:         "gitops_arc_blocks_arc_label_path",
			relabeled:    copyRuleWithLabels(upPlatformRule, managementlabels.RuleManagedByLabel, managementlabels.ManagedByOperator),
			ruleID:       upPlatformRuleId,
			wantWritable: false,
			wantManaged:  management.ManagedByGitOps,
			setup: func(t *testing.T, mockK8s *testutils.MockClient) {
				setupPreviewPlatformMocks(t, mockK8s, false)
				mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
					return &testutils.MockAlertRelabelConfigInterface{
						GetFunc: func(_ context.Context, ns, name string) (*osmv1.AlertRelabelConfig, bool, error) {
							return &osmv1.AlertRelabelConfig{
								ObjectMeta: metav1.ObjectMeta{
									Name: name, Namespace: ns,
									Annotations: map[string]string{"argocd.argoproj.io/tracking-id": "abc"},
								},
							}, true, nil
						},
					}
				}
			},
			preview: management.PreviewUpdateRequest{
				RuleID: upPlatformRuleId,
				Labels: map[string]*string{"severity": &info},
			},
			execute: func(client management.Client) error {
				updated := copyRule(upOriginalPlatformRule)
				updated.Labels["severity"] = "info"
				return client.UpdatePlatformAlertRule(context.Background(), upPlatformRuleId, updated)
			},
		},
		{
			name:         "operator_relabeled_rule_allows_arc_label_path",
			relabeled:    copyRuleWithLabels(upPlatformRule, managementlabels.RuleManagedByLabel, managementlabels.ManagedByOperator),
			ruleID:       upPlatformRuleId,
			wantWritable: true,
			setup: func(t *testing.T, mockK8s *testutils.MockClient) {
				setupPreviewPlatformMocks(t, mockK8s, false)
				mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
					return &testutils.MockAlertRelabelConfigInterface{
						GetFunc: func(_ context.Context, _, _ string) (*osmv1.AlertRelabelConfig, bool, error) {
							return nil, false, nil
						},
						CreateFunc: func(_ context.Context, arc osmv1.AlertRelabelConfig) (*osmv1.AlertRelabelConfig, error) {
							return &arc, nil
						},
					}
				}
			},
			preview: management.PreviewUpdateRequest{
				RuleID: upPlatformRuleId,
				Labels: map[string]*string{"severity": &info},
			},
			execute: func(client management.Client) error {
				updated := copyRule(upOriginalPlatformRule)
				updated.Labels["severity"] = "info"
				return client.UpdatePlatformAlertRule(context.Background(), upPlatformRuleId, updated)
			},
		},
		{
			name:         "writable_alerting_rule_allows_direct_label_path",
			relabeled:    upPlatformRule,
			ruleID:       upPlatformRuleId,
			wantWritable: true,
			setup: func(t *testing.T, mockK8s *testutils.MockClient) {
				setupPreviewPlatformMocks(t, mockK8s, true)
				mockK8s.AlertingRulesFunc = func() k8s.AlertingRuleInterface {
					return &testutils.MockAlertingRuleInterface{
						GetFunc: func(_ context.Context, name string) (*osmv1.AlertingRule, bool, error) {
							return &osmv1.AlertingRule{
								ObjectMeta: metav1.ObjectMeta{
									Name:      name,
									Namespace: k8s.ClusterMonitoringNamespace,
								},
								Spec: osmv1.AlertingRuleSpec{
									Groups: []osmv1.RuleGroup{{
										Name: "platform-alert-rules",
										Rules: []osmv1.Rule{{
											Alert:  upOriginalPlatformRule.Alert,
											Expr:   intstr.FromString(upOriginalPlatformRule.Expr.String()),
											Labels: copyStringMap(upOriginalPlatformRule.Labels),
										}},
									}},
								},
							}, true, nil
						},
						UpdateFunc: func(_ context.Context, _ osmv1.AlertingRule) error { return nil },
					}
				}
			},
			preview: management.PreviewUpdateRequest{
				RuleID: upPlatformRuleId,
				Labels: map[string]*string{"severity": &info},
			},
			execute: func(client management.Client) error {
				updated := copyRule(upOriginalPlatformRule)
				updated.Labels["severity"] = "info"
				return client.UpdatePlatformAlertRule(context.Background(), upPlatformRuleId, updated)
			},
		},
		{
			name:         "gitops_alerting_rule_blocks_direct_label_path",
			relabeled:    upPlatformRule,
			ruleID:       upPlatformRuleId,
			wantWritable: false,
			wantManaged:  management.ManagedByGitOps,
			setup: func(t *testing.T, mockK8s *testutils.MockClient) {
				setupPreviewPlatformMocks(t, mockK8s, true)
				mockK8s.AlertingRulesFunc = func() k8s.AlertingRuleInterface {
					return &testutils.MockAlertingRuleInterface{
						GetFunc: func(_ context.Context, name string) (*osmv1.AlertingRule, bool, error) {
							return &osmv1.AlertingRule{
								ObjectMeta: metav1.ObjectMeta{
									Name:      name,
									Namespace: k8s.ClusterMonitoringNamespace,
									Annotations: map[string]string{
										"argocd.argoproj.io/tracking-id": "gitops",
									},
								},
								Spec: osmv1.AlertingRuleSpec{
									Groups: []osmv1.RuleGroup{{
										Name: "platform-alert-rules",
										Rules: []osmv1.Rule{{
											Alert:  upOriginalPlatformRule.Alert,
											Expr:   intstr.FromString(upOriginalPlatformRule.Expr.String()),
											Labels: copyStringMap(upOriginalPlatformRule.Labels),
										}},
									}},
								},
							}, true, nil
						},
					}
				}
			},
			preview: management.PreviewUpdateRequest{
				RuleID: upPlatformRuleId,
				Labels: map[string]*string{"severity": &info},
			},
			execute: func(client management.Client) error {
				updated := copyRule(upOriginalPlatformRule)
				updated.Labels["severity"] = "info"
				return client.UpdatePlatformAlertRule(context.Background(), upPlatformRuleId, updated)
			},
		},
		{
			name:         "combined_classification_and_labels_requires_both_targets_writable",
			relabeled:    upPlatformRule,
			ruleID:       upPlatformRuleId,
			wantWritable: true,
			setup: func(t *testing.T, mockK8s *testutils.MockClient) {
				setupPreviewPlatformMocks(t, mockK8s, true)
				mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
					return &testutils.MockAlertRelabelConfigInterface{
						GetFunc: func(_ context.Context, _, _ string) (*osmv1.AlertRelabelConfig, bool, error) {
							return nil, false, nil
						},
						CreateFunc: func(_ context.Context, arc osmv1.AlertRelabelConfig) (*osmv1.AlertRelabelConfig, error) {
							return &arc, nil
						},
					}
				}
				mockK8s.AlertingRulesFunc = func() k8s.AlertingRuleInterface {
					return &testutils.MockAlertingRuleInterface{
						GetFunc: func(_ context.Context, name string) (*osmv1.AlertingRule, bool, error) {
							return &osmv1.AlertingRule{
								ObjectMeta: metav1.ObjectMeta{
									Name:      name,
									Namespace: k8s.ClusterMonitoringNamespace,
								},
								Spec: osmv1.AlertingRuleSpec{
									Groups: []osmv1.RuleGroup{{
										Name: "platform-alert-rules",
										Rules: []osmv1.Rule{{
											Alert:  upOriginalPlatformRule.Alert,
											Expr:   intstr.FromString(upOriginalPlatformRule.Expr.String()),
											Labels: copyStringMap(upOriginalPlatformRule.Labels),
										}},
									}},
								},
							}, true, nil
						},
						UpdateFunc: func(_ context.Context, _ osmv1.AlertingRule) error { return nil },
					}
				}
			},
			preview: management.PreviewUpdateRequest{
				RuleID: upPlatformRuleId,
				Labels: map[string]*string{"severity": &info},
				Classification: &management.UpdateRuleClassificationRequest{
					RuleId:       upPlatformRuleId,
					Component:    &component,
					ComponentSet: true,
				},
			},
			execute: func(client management.Client) error {
				if err := client.UpdateAlertRuleClassification(context.Background(), management.UpdateRuleClassificationRequest{
					RuleId:       upPlatformRuleId,
					Component:    &component,
					ComponentSet: true,
				}); err != nil {
					return err
				}
				_, err := client.UpdateAlertRuleLabels(context.Background(), upPlatformRuleId, map[string]*string{
					"severity": &info,
				})
				return err
			},
		},
		{
			name:         "combined_update_blocked_when_gitops_arc_would_fail_labels",
			relabeled:    upPlatformRule,
			ruleID:       upPlatformRuleId,
			wantWritable: false,
			wantManaged:  management.ManagedByGitOps,
			setup: func(t *testing.T, mockK8s *testutils.MockClient) {
				setupPreviewPlatformMocks(t, mockK8s, false)
				mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
					return &testutils.MockAlertRelabelConfigInterface{
						GetFunc: func(_ context.Context, ns, name string) (*osmv1.AlertRelabelConfig, bool, error) {
							return &osmv1.AlertRelabelConfig{
								ObjectMeta: metav1.ObjectMeta{
									Name: name, Namespace: ns,
									Annotations: map[string]string{"argocd.argoproj.io/tracking-id": "abc"},
								},
							}, true, nil
						},
					}
				}
			},
			preview: management.PreviewUpdateRequest{
				RuleID: upPlatformRuleId,
				Labels: map[string]*string{"severity": &info},
				Classification: &management.UpdateRuleClassificationRequest{
					RuleId:       upPlatformRuleId,
					Component:    &component,
					ComponentSet: true,
				},
			},
			execute: func(client management.Client) error {
				if err := client.UpdateAlertRuleClassification(context.Background(), management.UpdateRuleClassificationRequest{
					RuleId:       upPlatformRuleId,
					Component:    &component,
					ComponentSet: true,
				}); err != nil {
					return err
				}
				_, err := client.UpdateAlertRuleLabels(context.Background(), upPlatformRuleId, map[string]*string{
					"severity": &info,
				})
				return err
			},
		},
		{
			name:         "user_defined_gitops_parity",
			ruleID:       originalUserRuleId,
			wantWritable: false,
			wantManaged:  management.ManagedByGitOps,
			setup: func(_ *testing.T, mockK8s *testutils.MockClient) {
				gitopsRule := copyRuleWithLabels(udUserRule, managementlabels.RuleManagedByLabel, managementlabels.ManagedByGitOps)
				mockK8s.NamespaceFunc = func() k8s.NamespaceInterface {
					return &testutils.MockNamespaceInterface{
						IsClusterMonitoringNamespaceFunc: func(string) bool { return false },
					}
				}
				mockK8s.RelabeledRulesFunc = mockUDRelabeledGet(originalUserRuleId, gitopsRule)
				mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
					return makePRWithRule("user-namespace", "user-rule", originalUserRule)
				}
			},
			preview: management.PreviewUpdateRequest{
				RuleID: originalUserRuleId,
				Labels: map[string]*string{"severity": &critical},
			},
			execute: func(client management.Client) error {
				_, err := client.UpdateAlertRuleLabels(context.Background(), originalUserRuleId, map[string]*string{
					"severity": &critical,
				})
				return err
			},
		},
	}

	for _, tc := range fixtures {
		t.Run(tc.name, func(t *testing.T) {
			client, mockK8s := newUpdatePlatformClient(t)
			if tc.setup != nil {
				tc.setup(t, mockK8s)
			}
			if tc.relabeled.Labels != nil {
				mockK8s.RelabeledRulesFunc = mockPlatformRelabeledGet(tc.ruleID, tc.relabeled)
			}

			var arcMutated, arUpdated, prUpdated bool
			wrapMockPersistFlags(mockK8s, &arcMutated, &arUpdated, &prUpdated)

			plan, err := client.PreviewAlertRuleUpdate(context.Background(), tc.preview)
			if err != nil {
				t.Fatalf("PreviewAlertRuleUpdate: %v", err)
			}
			if plan.Writable != tc.wantWritable {
				t.Fatalf("preview writable=%v, want %v (managedBy=%v)", plan.Writable, tc.wantWritable, plan.ManagedBy)
			}
			if !tc.wantWritable && tc.wantManaged != "" {
				if plan.ManagedBy == nil || *plan.ManagedBy != tc.wantManaged {
					t.Fatalf("preview managedBy=%v, want %q", plan.ManagedBy, tc.wantManaged)
				}
			}
			if arcMutated || arUpdated || prUpdated {
				t.Fatal("preview must not persist cluster changes")
			}

			arcMutated = false
			arUpdated = false
			prUpdated = false

			execErr := tc.execute(client)
			if tc.wantWritable {
				if execErr != nil {
					t.Fatalf("execute expected success, got %v", execErr)
				}
			} else {
				if execErr == nil {
					t.Fatal("execute expected failure for non-writable preview")
				}
				var na *management.NotAllowedError
				if !errors.As(execErr, &na) {
					t.Fatalf("execute expected NotAllowedError, got %v", execErr)
				}
				if tc.wantManaged == management.ManagedByGitOps && !strings.Contains(execErr.Error(), "GitOps") {
					t.Fatalf("execute error should mention GitOps, got %v", execErr)
				}
			}
		})
	}
}

func wrapMockPersistFlags(mockK8s *testutils.MockClient, arcMutated, arUpdated, prUpdated *bool) {
	if mockK8s.AlertRelabelConfigsFunc != nil {
		origARC := mockK8s.AlertRelabelConfigsFunc
		mockK8s.AlertRelabelConfigsFunc = func() k8s.AlertRelabelConfigInterface {
			inner := origARC()
			if mock, ok := inner.(*testutils.MockAlertRelabelConfigInterface); ok {
				prevCreate := mock.CreateFunc
				mock.CreateFunc = func(ctx context.Context, arc osmv1.AlertRelabelConfig) (*osmv1.AlertRelabelConfig, error) {
					*arcMutated = true
					if prevCreate != nil {
						return prevCreate(ctx, arc)
					}
					return &arc, nil
				}
				prevUpdate := mock.UpdateFunc
				mock.UpdateFunc = func(ctx context.Context, arc osmv1.AlertRelabelConfig) error {
					*arcMutated = true
					if prevUpdate != nil {
						return prevUpdate(ctx, arc)
					}
					return nil
				}
			}
			return inner
		}
	}
	if mockK8s.AlertingRulesFunc != nil {
		origAR := mockK8s.AlertingRulesFunc
		mockK8s.AlertingRulesFunc = func() k8s.AlertingRuleInterface {
			inner := origAR()
			if mock, ok := inner.(*testutils.MockAlertingRuleInterface); ok {
				prevUpdate := mock.UpdateFunc
				mock.UpdateFunc = func(ctx context.Context, ar osmv1.AlertingRule) error {
					*arUpdated = true
					if prevUpdate != nil {
						return prevUpdate(ctx, ar)
					}
					return nil
				}
			}
			return inner
		}
	}
	if mockK8s.PrometheusRulesFunc != nil {
		origPR := mockK8s.PrometheusRulesFunc
		mockK8s.PrometheusRulesFunc = func() k8s.PrometheusRuleInterface {
			inner := origPR()
			if mock, ok := inner.(*testutils.MockPrometheusRuleInterface); ok {
				prevUpdate := mock.UpdateFunc
				mock.UpdateFunc = func(ctx context.Context, pr monitoringv1.PrometheusRule) error {
					*prUpdated = true
					if prevUpdate != nil {
						return prevUpdate(ctx, pr)
					}
					return nil
				}
				prevAddRule := mock.AddRuleFunc
				mock.AddRuleFunc = func(ctx context.Context, nn types.NamespacedName, groupName string, rule monitoringv1.Rule) error {
					*prUpdated = true
					if prevAddRule != nil {
						return prevAddRule(ctx, nn, groupName, rule)
					}
					return nil
				}
			}
			return inner
		}
	}
}
