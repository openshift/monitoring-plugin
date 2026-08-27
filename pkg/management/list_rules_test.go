package management_test

import (
	"context"
	"errors"
	"testing"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

var (
	lrRule1 = monitoringv1.Rule{
		Alert: "Alert1",
		Expr:  intstr.FromString("up == 0"),
		Labels: map[string]string{
			"severity":                       "warning",
			k8s.PrometheusRuleLabelNamespace: "namespace1",
			k8s.PrometheusRuleLabelName:      "rule1",
			k8s.AlertRuleLabelId:             "rid_aaa",
		},
	}

	lrRule2 = monitoringv1.Rule{
		Alert: "Alert2",
		Expr:  intstr.FromString("up == 0"),
		Labels: map[string]string{
			"severity":                       "critical",
			k8s.PrometheusRuleLabelNamespace: "namespace1",
			k8s.PrometheusRuleLabelName:      "rule2",
			k8s.AlertRuleLabelId:             "rid_bbb",
		},
	}

	lrRule3 = monitoringv1.Rule{
		Alert: "Alert3",
		Expr:  intstr.FromString("down == 1"),
		Labels: map[string]string{
			"severity":                       "warning",
			k8s.PrometheusRuleLabelNamespace: "namespace2",
			k8s.PrometheusRuleLabelName:      "rule3",
			k8s.AlertRuleLabelId:             "rid_ccc",
		},
	}

	lrPlatformRule = monitoringv1.Rule{
		Alert: "PlatformAlert",
		Expr:  intstr.FromString("node_down == 1"),
		Labels: map[string]string{
			"severity":                       "critical",
			k8s.AlertSourceLabel:             k8s.AlertSourcePlatform,
			k8s.PrometheusRuleLabelNamespace: "openshift-monitoring",
			k8s.PrometheusRuleLabelName:      "platform-rule",
			k8s.AlertRuleLabelId:             "rid_ddd",
		},
	}

	lrCustomLabelRule = monitoringv1.Rule{
		Alert: "CustomLabelAlert",
		Expr:  intstr.FromString("custom == 1"),
		Labels: map[string]string{
			"severity":                       "info",
			"team":                           "backend",
			"env":                            "production",
			k8s.PrometheusRuleLabelNamespace: "namespace1",
			k8s.PrometheusRuleLabelName:      "rule1",
			k8s.AlertRuleLabelId:             "rid_eee",
		},
	}
)

func newListRulesClient(t *testing.T, rules []monitoringv1.Rule) management.Client {
	t.Helper()
	mockK8s := &testutils.MockClient{
		RelabeledRulesFunc: func() k8s.RelabeledRulesInterface {
			return &testutils.MockRelabeledRulesInterface{
				ListFunc: func(_ context.Context) []monitoringv1.Rule { return rules },
			}
		},
	}
	return management.New(context.Background(), mockK8s)
}

var allLRRules = []monitoringv1.Rule{lrRule1, lrRule2, lrRule3, lrPlatformRule, lrCustomLabelRule}
var noPagination = management.PaginationOptions{}

func TestListRules_MissingNamespaceReturnsValidationError(t *testing.T) {
	client := newListRulesClient(t, allLRRules)
	_, err := client.ListRules(context.Background(),
		management.PrometheusRuleOptions{Name: "rule1"},
		management.AlertRuleOptions{},
		noPagination,
	)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	var ve *management.ValidationError
	if !errors.As(err, &ve) {
		t.Fatalf("expected ValidationError, got %T: %v", err, err)
	}
	if !containsSubstring(err.Error(), "namespace is required when prometheusRuleName is specified") {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestListRules_NoFiltersReturnsAll(t *testing.T) {
	client := newListRulesClient(t, allLRRules)
	result, err := client.ListRules(context.Background(),
		management.PrometheusRuleOptions{},
		management.AlertRuleOptions{},
		noPagination,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Rules) != 5 {
		t.Errorf("expected 5 rules, got %d", len(result.Rules))
	}
	if result.NextToken != "" {
		t.Errorf("expected no next token, got %q", result.NextToken)
	}
}

func TestListRules_FilterByNameAndNamespace(t *testing.T) {
	client := newListRulesClient(t, allLRRules)
	result, err := client.ListRules(context.Background(),
		management.PrometheusRuleOptions{Name: "rule1", Namespace: "namespace1"},
		management.AlertRuleOptions{},
		noPagination,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Rules) != 2 {
		t.Fatalf("expected 2 rules, got %d", len(result.Rules))
	}
	for _, r := range result.Rules {
		if r.Alert != "Alert1" && r.Alert != "CustomLabelAlert" {
			t.Errorf("unexpected rule: %s", r.Alert)
		}
	}
}

func TestListRules_FilterByNameAndNamespace_NoMatch(t *testing.T) {
	client := newListRulesClient(t, allLRRules)
	result, err := client.ListRules(context.Background(),
		management.PrometheusRuleOptions{Name: "nonexistent", Namespace: "namespace1"},
		management.AlertRuleOptions{},
		noPagination,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Rules) != 0 {
		t.Errorf("expected 0 rules, got %d", len(result.Rules))
	}
}

func TestListRules_FilterByAlertName(t *testing.T) {
	client := newListRulesClient(t, allLRRules)
	result, err := client.ListRules(context.Background(),
		management.PrometheusRuleOptions{},
		management.AlertRuleOptions{Name: "Alert1"},
		noPagination,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Rules) != 1 || result.Rules[0].Alert != "Alert1" {
		t.Errorf("expected 1 rule Alert1, got %v", result.Rules)
	}
}

func TestListRules_FilterByAlertName_NoMatch(t *testing.T) {
	client := newListRulesClient(t, allLRRules)
	result, err := client.ListRules(context.Background(),
		management.PrometheusRuleOptions{},
		management.AlertRuleOptions{Name: "NonexistentAlert"},
		noPagination,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Rules) != 0 {
		t.Errorf("expected 0 rules, got %d", len(result.Rules))
	}
}

func TestListRules_FilterBySourcePlatform(t *testing.T) {
	client := newListRulesClient(t, allLRRules)
	result, err := client.ListRules(context.Background(),
		management.PrometheusRuleOptions{},
		management.AlertRuleOptions{Source: k8s.AlertSourcePlatform},
		noPagination,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Rules) != 1 {
		t.Fatalf("expected 1 rule, got %d", len(result.Rules))
	}
	if result.Rules[0].Alert != "PlatformAlert" {
		t.Errorf("expected PlatformAlert, got %s", result.Rules[0].Alert)
	}
	if result.Rules[0].Labels[k8s.AlertSourceLabel] != k8s.AlertSourcePlatform {
		t.Errorf("expected source=platform, got %s", result.Rules[0].Labels[k8s.AlertSourceLabel])
	}
}

func TestListRules_FilterBySingleLabel(t *testing.T) {
	client := newListRulesClient(t, allLRRules)
	result, err := client.ListRules(context.Background(),
		management.PrometheusRuleOptions{},
		management.AlertRuleOptions{Labels: map[string]string{"severity": "warning"}},
		noPagination,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Rules) != 2 {
		t.Errorf("expected 2 warning rules, got %d", len(result.Rules))
	}
}

func TestListRules_FilterByMultipleLabels(t *testing.T) {
	client := newListRulesClient(t, allLRRules)
	result, err := client.ListRules(context.Background(),
		management.PrometheusRuleOptions{},
		management.AlertRuleOptions{Labels: map[string]string{"team": "backend", "env": "production"}},
		noPagination,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Rules) != 1 || result.Rules[0].Alert != "CustomLabelAlert" {
		t.Errorf("expected 1 CustomLabelAlert, got %v", result.Rules)
	}
}

func TestListRules_FilterByLabels_NoMatch(t *testing.T) {
	client := newListRulesClient(t, allLRRules)
	result, err := client.ListRules(context.Background(),
		management.PrometheusRuleOptions{},
		management.AlertRuleOptions{Labels: map[string]string{"nonexistent": "value"}},
		noPagination,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Rules) != 0 {
		t.Errorf("expected 0 rules, got %d", len(result.Rules))
	}
}

func TestListRules_CombinedFilters(t *testing.T) {
	client := newListRulesClient(t, allLRRules)
	result, err := client.ListRules(context.Background(),
		management.PrometheusRuleOptions{Name: "rule1", Namespace: "namespace1"},
		management.AlertRuleOptions{Labels: map[string]string{"severity": "warning"}},
		noPagination,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Rules) != 1 || result.Rules[0].Alert != "Alert1" {
		t.Errorf("expected 1 Alert1, got %v", result.Rules)
	}
}

func TestListRules_CombinedFilters_NoMatch(t *testing.T) {
	client := newListRulesClient(t, allLRRules)
	result, err := client.ListRules(context.Background(),
		management.PrometheusRuleOptions{Name: "rule1", Namespace: "namespace1"},
		management.AlertRuleOptions{Labels: map[string]string{"severity": "critical"}},
		noPagination,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Rules) != 0 {
		t.Errorf("expected 0 rules, got %d", len(result.Rules))
	}
}

func TestListRules_EmptyRelabeledRules(t *testing.T) {
	client := newListRulesClient(t, []monitoringv1.Rule{})
	result, err := client.ListRules(context.Background(),
		management.PrometheusRuleOptions{},
		management.AlertRuleOptions{},
		noPagination,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Rules) != 0 {
		t.Errorf("expected 0 rules, got %d", len(result.Rules))
	}
}

func TestListRules_Pagination_FirstPage(t *testing.T) {
	client := newListRulesClient(t, allLRRules)
	result, err := client.ListRules(context.Background(),
		management.PrometheusRuleOptions{},
		management.AlertRuleOptions{},
		management.PaginationOptions{Limit: 2},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Rules) != 2 {
		t.Fatalf("expected 2 rules, got %d", len(result.Rules))
	}
	if result.NextToken == "" {
		t.Error("expected next token, got empty")
	}
	if result.Rules[0].Labels[k8s.AlertRuleLabelId] != "rid_aaa" {
		t.Errorf("expected rid_aaa, got %s", result.Rules[0].Labels[k8s.AlertRuleLabelId])
	}
	if result.Rules[1].Labels[k8s.AlertRuleLabelId] != "rid_bbb" {
		t.Errorf("expected rid_bbb, got %s", result.Rules[1].Labels[k8s.AlertRuleLabelId])
	}
}

func TestListRules_Pagination_SecondPage(t *testing.T) {
	client := newListRulesClient(t, allLRRules)
	first, err := client.ListRules(context.Background(),
		management.PrometheusRuleOptions{},
		management.AlertRuleOptions{},
		management.PaginationOptions{Limit: 2},
	)
	if err != nil {
		t.Fatalf("unexpected error on first page: %v", err)
	}

	second, err := client.ListRules(context.Background(),
		management.PrometheusRuleOptions{},
		management.AlertRuleOptions{},
		management.PaginationOptions{Limit: 2, NextToken: first.NextToken},
	)
	if err != nil {
		t.Fatalf("unexpected error on second page: %v", err)
	}
	if len(second.Rules) != 2 {
		t.Fatalf("expected 2 rules on second page, got %d", len(second.Rules))
	}
	if second.Rules[0].Labels[k8s.AlertRuleLabelId] != "rid_ccc" {
		t.Errorf("expected rid_ccc, got %s", second.Rules[0].Labels[k8s.AlertRuleLabelId])
	}
	if second.Rules[1].Labels[k8s.AlertRuleLabelId] != "rid_ddd" {
		t.Errorf("expected rid_ddd, got %s", second.Rules[1].Labels[k8s.AlertRuleLabelId])
	}
	if second.NextToken == "" {
		t.Error("expected next token for third page")
	}
}

func TestListRules_Pagination_LastPageNoNextToken(t *testing.T) {
	client := newListRulesClient(t, allLRRules)
	first, err := client.ListRules(context.Background(),
		management.PrometheusRuleOptions{},
		management.AlertRuleOptions{},
		management.PaginationOptions{Limit: 2},
	)
	if err != nil {
		t.Fatalf("page 1 error: %v", err)
	}
	second, err := client.ListRules(context.Background(),
		management.PrometheusRuleOptions{},
		management.AlertRuleOptions{},
		management.PaginationOptions{Limit: 2, NextToken: first.NextToken},
	)
	if err != nil {
		t.Fatalf("page 2 error: %v", err)
	}
	third, err := client.ListRules(context.Background(),
		management.PrometheusRuleOptions{},
		management.AlertRuleOptions{},
		management.PaginationOptions{Limit: 2, NextToken: second.NextToken},
	)
	if err != nil {
		t.Fatalf("page 3 error: %v", err)
	}
	if len(third.Rules) != 1 {
		t.Errorf("expected 1 rule on last page, got %d", len(third.Rules))
	}
	if third.NextToken != "" {
		t.Errorf("expected no next token on last page, got %q", third.NextToken)
	}
}

func TestListRules_Pagination_LimitExceedsTotal(t *testing.T) {
	client := newListRulesClient(t, allLRRules)
	result, err := client.ListRules(context.Background(),
		management.PrometheusRuleOptions{},
		management.AlertRuleOptions{},
		management.PaginationOptions{Limit: 100},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Rules) != 5 {
		t.Errorf("expected 5 rules, got %d", len(result.Rules))
	}
	if result.NextToken != "" {
		t.Errorf("expected no next token, got %q", result.NextToken)
	}
}

func TestListRules_Pagination_SortedByRuleId(t *testing.T) {
	client := newListRulesClient(t, allLRRules)
	result, err := client.ListRules(context.Background(),
		management.PrometheusRuleOptions{},
		management.AlertRuleOptions{},
		noPagination,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for i := 1; i < len(result.Rules); i++ {
		prev := result.Rules[i-1].Labels[k8s.AlertRuleLabelId]
		curr := result.Rules[i].Labels[k8s.AlertRuleLabelId]
		if prev >= curr {
			t.Errorf("rules not sorted: %s >= %s at index %d", prev, curr, i)
		}
	}
}

// containsSubstring is a local helper to avoid importing strings in test files
// that don't otherwise need it.
func containsSubstring(s, sub string) bool {
	if len(sub) == 0 {
		return true
	}
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
