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

func TestKubevirtVMClassificationWithoutOverrides(t *testing.T) {
	labels := map[string]string{
		"alertname":                     "VMDown",
		"kubernetes_operator_part_of":   "kubevirt",
		"kubernetes_operator_component": "kubevirt",
		"operator_health_impact":        "none",
		"name":                          "example-vm",
		"namespace":                     "example-workload",
		k8s.AlertSourceLabel:            k8s.AlertSourcePlatform,
	}
	wantComponent := "openshift-virtualization-virtual-machine"
	wantLayer := "namespace"
	rule := monitoringv1.Rule{Alert: "VMDown", Labels: labels}
	component, layer := classifyFromRule(&rule)
	if component != wantComponent || layer != wantLayer {
		t.Errorf("rule classification = (%q, %q), want (%q, %q)", component, layer, wantComponent, wantLayer)
	}
	component, layer = classifyFromAlertLabels(labels)
	if component != wantComponent || layer != wantLayer {
		t.Errorf("alert classification = (%q, %q), want (%q, %q)", component, layer, wantComponent, wantLayer)
	}
}

func TestPartialClassificationOverridesPreserveSourceFallback(t *testing.T) {
	const vmComponent = "openshift-virtualization-virtual-machine"
	tests := []struct {
		name          string
		labels        map[string]string
		wantComponent string
		wantLayer     string
	}{
		{
			name: "component override with platform source",
			labels: map[string]string{
				k8s.AlertRuleClassificationComponentKey: vmComponent,
				k8s.AlertSourceLabel:                    k8s.AlertSourcePlatform,
			},
			wantComponent: vmComponent,
			wantLayer:     "cluster",
		},
		{
			name: "component override with user source",
			labels: map[string]string{
				k8s.AlertRuleClassificationComponentKey: vmComponent,
				k8s.AlertSourceLabel:                    k8s.AlertSourceUser,
			},
			wantComponent: vmComponent,
			wantLayer:     "namespace",
		},
		{
			name: "layer override takes precedence over platform source",
			labels: map[string]string{
				k8s.AlertRuleClassificationLayerKey: "namespace",
				k8s.AlertSourceLabel:                k8s.AlertSourcePlatform,
			},
			wantComponent: "others",
			wantLayer:     "namespace",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule := monitoringv1.Rule{Alert: "CustomAlert", Labels: tt.labels}
			component, layer := classifyFromRule(&rule)
			if component != tt.wantComponent || layer != tt.wantLayer {
				t.Errorf("rule classification = (%q, %q), want (%q, %q)", component, layer, tt.wantComponent, tt.wantLayer)
			}
			component, layer = classifyFromAlertLabels(tt.labels)
			if component != tt.wantComponent || layer != tt.wantLayer {
				t.Errorf("alert classification = (%q, %q), want (%q, %q)", component, layer, tt.wantComponent, tt.wantLayer)
			}
		})
	}
}
