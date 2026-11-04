package management

import (
	"testing"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"github.com/prometheus/common/model"

	"github.com/openshift/monitoring-plugin/pkg/alertcomponent"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

func TestDeprecatedMachineTypeClassificationMatchesKubevirtVM(t *testing.T) {
	wantLayer, wantComponent := alertcomponent.DetermineComponent(model.LabelSet{
		"kubernetes_operator_part_of":   "kubevirt",
		"kubernetes_operator_component": "kubevirt",
		"operator_health_impact":        "none",
	})
	rule := monitoringv1.Rule{
		Alert: "DeprecatedMachineType",
		Labels: map[string]string{
			"kubernetes_operator_part_of":           "kubevirt",
			"kubernetes_operator_component":         "hyperconverged-cluster-operator",
			"operator_health_impact":                "none",
			"severity":                              "warning",
			k8s.AlertRuleClassificationComponentKey: "openshift-virtualization-virtual-machine",
			k8s.AlertRuleClassificationLayerKey:     "namespace",
		},
	}
	component, layer := classifyFromRule(&rule)
	if component != wantComponent || layer != wantLayer {
		t.Fatalf("rule classification = (%q, %q), want (%q, %q)", component, layer, wantComponent, wantLayer)
	}

	rule.Labels["alertname"] = rule.Alert
	rule.Labels["name"] = "example-vm"
	rule.Labels["namespace"] = "example-workload"
	component, layer = classifyFromAlertLabels(rule.Labels)
	if component != wantComponent || layer != wantLayer {
		t.Fatalf("alert classification = (%q, %q), want (%q, %q)", component, layer, wantComponent, wantLayer)
	}
}
