package management

import (
	"testing"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

func TestDeprecatedMachineTypeClassificationMatchesKubevirtVM(t *testing.T) {
	wantComponent := "openshift-virtualization-virtual-machine"
	wantLayer := "namespace"
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
	component, layer := classifyFromRule(&rule, rule.Labels, rule.Labels[k8s.AlertSourceLabel])
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
	component, layer := classifyFromRule(&rule, labels, labels[k8s.AlertSourceLabel])
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
			component, layer := classifyFromRule(&rule, tt.labels, tt.labels[k8s.AlertSourceLabel])
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

func TestOperatorNamespaceFallbackDerivesLayerFromSource(t *testing.T) {
	tests := []struct {
		name          string
		labels        map[string]string
		wantComponent string
		wantLayer     string
	}{
		{
			name: "platform alert in unmapped operator namespace gets the cluster layer",
			labels: map[string]string{
				"alertname":          "CsvAbnormalOver30Min",
				"namespace":          "openshift-sriov-network-operator",
				k8s.AlertSourceLabel: k8s.AlertSourcePlatform,
			},
			wantComponent: "openshift-sriov-network-operator",
			wantLayer:     "cluster",
		},
		{
			name: "user alert in unmapped operator namespace gets the namespace layer",
			labels: map[string]string{
				"alertname":          "SomeAlert",
				"namespace":          "openshift-sriov-network-operator",
				k8s.AlertSourceLabel: k8s.AlertSourceUser,
			},
			wantComponent: "openshift-sriov-network-operator",
			wantLayer:     "namespace",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			component, layer := classifyFromAlertLabels(tt.labels)
			if component != tt.wantComponent || layer != tt.wantLayer {
				t.Errorf("alert classification = (%q, %q), want (%q, %q)", component, layer, tt.wantComponent, tt.wantLayer)
			}
			rule := monitoringv1.Rule{Alert: tt.labels["alertname"], Labels: tt.labels}
			component, layer = classifyFromRule(&rule, tt.labels, tt.labels[k8s.AlertSourceLabel])
			if component != tt.wantComponent || layer != tt.wantLayer {
				t.Errorf("rule classification = (%q, %q), want (%q, %q)", component, layer, tt.wantComponent, tt.wantLayer)
			}
		})
	}
}

func TestClassifyFromRulePrefersAlertNamespace(t *testing.T) {
	tests := []struct {
		name          string
		ruleLabels    map[string]string
		alertLabels   map[string]string
		wantComponent string
		wantLayer     string
	}{
		{
			name: "general platform rule classifies by the affected namespace",
			ruleLabels: map[string]string{
				"severity":                       "warning",
				k8s.PrometheusRuleLabelNamespace: k8s.ClusterMonitoringNamespace,
				k8s.PrometheusRuleLabelName:      "kubernetes.rules",
			},
			alertLabels: map[string]string{
				"alertname": "TargetDown",
				"namespace": "clusters-rabin",
				"severity":  "warning",
				"job":       "olm-operator-metrics",
			},
			wantComponent: "others",
			wantLayer:     "namespace",
		},
		{
			name: "alert in an operator namespace classifies by that namespace",
			ruleLabels: map[string]string{
				"severity":                       "warning",
				k8s.PrometheusRuleLabelNamespace: "openshift-kube-controller-manager-operator",
				k8s.PrometheusRuleLabelName:      "kube-controller-manager-operator",
			},
			alertLabels: map[string]string{
				"alertname": "PodDisruptionBudgetAtLimit",
				"namespace": "darwin",
				"severity":  "warning",
			},
			wantComponent: "others",
			wantLayer:     "namespace",
		},
		{
			name: "alert in a core platform namespace keeps the cluster layer",
			ruleLabels: map[string]string{
				"severity":                       "warning",
				k8s.PrometheusRuleLabelNamespace: k8s.ClusterMonitoringNamespace,
				k8s.PrometheusRuleLabelName:      "kubernetes.rules",
			},
			alertLabels: map[string]string{
				"alertname": "KubePodCrashLooping",
				"namespace": "openshift-cnv",
				"severity":  "warning",
			},
			wantComponent: "openshift-virtualization-operator",
			wantLayer:     "cluster",
		},
		{
			name: "explicit rule namespace label pins the classification",
			ruleLabels: map[string]string{
				"severity":  "warning",
				"namespace": "openshift-monitoring",
			},
			alertLabels: map[string]string{
				"alertname": "KubePodCrashLooping",
				"namespace": "openshift-cnv",
				"severity":  "warning",
			},
			wantComponent: "monitoring",
			wantLayer:     "cluster",
		},
		{
			name: "namespace-less alert falls back to the rule namespace",
			ruleLabels: map[string]string{
				"severity":                       "warning",
				k8s.PrometheusRuleLabelNamespace: k8s.ClusterMonitoringNamespace,
				k8s.PrometheusRuleLabelName:      "kubernetes.rules",
			},
			alertLabels: map[string]string{
				"alertname": "KubePodCrashLooping",
				"severity":  "warning",
			},
			wantComponent: "monitoring",
			wantLayer:     "cluster",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule := monitoringv1.Rule{Alert: tt.alertLabels["alertname"], Labels: tt.ruleLabels}
			component, layer := classifyFromRule(&rule, tt.alertLabels, k8s.AlertSourcePlatform)
			if component != tt.wantComponent || layer != tt.wantLayer {
				t.Errorf("rule classification = (%q, %q), want (%q, %q)", component, layer, tt.wantComponent, tt.wantLayer)
			}
		})
	}
}

func TestClassifyFromAlertLabelsAffectedNamespace(t *testing.T) {
	tests := []struct {
		name          string
		alertLabels   map[string]string
		wantComponent string
		wantLayer     string
	}{
		{
			name: "platform alert about a user namespace is namespace layer",
			alertLabels: map[string]string{
				"alertname":          "TargetDown",
				"namespace":          "clusters-rabin",
				k8s.AlertSourceLabel: k8s.AlertSourcePlatform,
			},
			wantComponent: "others",
			wantLayer:     "namespace",
		},
		{
			name: "platform alert about an openshift namespace keeps the cluster layer",
			alertLabels: map[string]string{
				"alertname":          "TargetDown",
				"namespace":          "openshift-pipelines",
				k8s.AlertSourceLabel: k8s.AlertSourcePlatform,
			},
			wantComponent: "openshift-pipelines",
			wantLayer:     "cluster",
		},
		{
			name: "platform alert about kube-system stays cluster layer",
			alertLabels: map[string]string{
				"alertname":          "CustomAlert",
				"namespace":          "kube-system",
				k8s.AlertSourceLabel: k8s.AlertSourcePlatform,
			},
			wantComponent: "kube-controller-manager",
			wantLayer:     "cluster",
		},
		{
			name: "namespace-less platform alert stays cluster layer",
			alertLabels: map[string]string{
				"alertname":          "CustomAlert",
				k8s.AlertSourceLabel: k8s.AlertSourcePlatform,
			},
			wantComponent: "others",
			wantLayer:     "cluster",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			component, layer := classifyFromAlertLabels(tt.alertLabels)
			if component != tt.wantComponent || layer != tt.wantLayer {
				t.Errorf("alert classification = (%q, %q), want (%q, %q)", component, layer, tt.wantComponent, tt.wantLayer)
			}
		})
	}
}
