package management

import (
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

const (
	prometheusRuleAPIVersion     = "monitoring.coreos.com/v1"
	prometheusRuleKind           = "PrometheusRule"
	alertingRuleAPIVersion       = "monitoring.openshift.io/v1"
	alertingRuleKind             = "AlertingRule"
	alertRelabelConfigAPIVersion = "monitoring.openshift.io/v1"
	alertRelabelConfigKind       = "AlertRelabelConfig"
)

// ManagementSource identifies an external management system owning a resource.
type ManagementSource string

const (
	ManagedByGitOps   ManagementSource = "gitops"
	ManagedByOperator ManagementSource = "operator"
)

// ResourceRef identifies a Kubernetes object targeted by a change plan.
type ResourceRef struct {
	APIVersion string `json:"apiVersion"`
	Kind       string `json:"kind"`
	Namespace  string `json:"namespace,omitempty"`
	Name       string `json:"name"`
}

// RuleChangeOperation is a semantic change operation for preview UI.
type RuleChangeOperation string

const (
	RuleChangeOpAdd     RuleChangeOperation = "add"
	RuleChangeOpReplace RuleChangeOperation = "replace"
	RuleChangeOpRemove  RuleChangeOperation = "remove"
)

// RuleChange describes one semantic before/after change for preview UI.
type RuleChange struct {
	Field        string              `json:"field"`
	Operation    RuleChangeOperation `json:"operation"`
	CurrentValue any                 `json:"currentValue,omitempty"`
	NewValue     any                 `json:"newValue,omitempty"`
}

// ResourceChangePlan describes one Kubernetes resource mutation in a preview plan.
type ResourceChangePlan struct {
	Resource      ResourceRef    `json:"resource"`
	Changes       []RuleChange   `json:"changes"`
	DesiredObject map[string]any `json:"desiredObject,omitempty"`
}

// RuleChangePlan is the result of planning a create or update without persisting.
type RuleChangePlan struct {
	Writable    bool                 `json:"writable"`
	ManagedBy   *ManagementSource    `json:"managedBy,omitempty"`
	Resources   []ResourceChangePlan `json:"resources"`
	DesiredRule monitoringv1.Rule    `json:"desiredRule"`
}

func prometheusRuleRef(namespace, name string) ResourceRef {
	return ResourceRef{
		APIVersion: prometheusRuleAPIVersion,
		Kind:       prometheusRuleKind,
		Namespace:  namespace,
		Name:       name,
	}
}

func alertingRuleRef(namespace, name string) ResourceRef {
	return ResourceRef{
		APIVersion: alertingRuleAPIVersion,
		Kind:       alertingRuleKind,
		Namespace:  namespace,
		Name:       name,
	}
}

func alertRelabelConfigRef(namespace, name string) ResourceRef {
	return ResourceRef{
		APIVersion: alertRelabelConfigAPIVersion,
		Kind:       alertRelabelConfigKind,
		Namespace:  namespace,
		Name:       name,
	}
}

func managedByFromRelabeledRule(relabeled monitoringv1.Rule) ManagementSource {
	if isRuleManagedByGitOpsLabel(relabeled) {
		return ManagedByGitOps
	}
	if isRuleManagedByOperator(relabeled) {
		return ManagedByOperator
	}
	return ""
}

func managedByFromObject(obj metav1.Object) ManagementSource {
	if obj == nil {
		return ""
	}
	gitOps, operator := k8s.IsExternallyManagedObject(obj)
	if operator {
		return ManagedByOperator
	}
	if gitOps {
		return ManagedByGitOps
	}
	return ""
}

func planManagedByPtr(source ManagementSource) *ManagementSource {
	if source == "" {
		return nil
	}
	s := source
	return &s
}
