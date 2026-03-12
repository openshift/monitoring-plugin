package alertcomponent

import (
	"regexp"
	"testing"

	"github.com/prometheus/common/model"

	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

func TestDetermineComponent_CoreComponents(t *testing.T) {
	tests := []struct {
		name          string
		labels        model.LabelSet
		wantLayer     string
		wantComponent string
	}{
		{
			name: "etcd namespace",
			labels: model.LabelSet{
				"namespace": "openshift-etcd",
				model.LabelName(managementlabels.AlertNameLabel): "etcdMembersDown",
			},
			wantLayer:     "cluster",
			wantComponent: "etcd",
		},
		{
			name: "kube-apiserver operator namespace",
			labels: model.LabelSet{
				"namespace": "openshift-kube-apiserver-operator",
				model.LabelName(managementlabels.AlertNameLabel): "SomeAlert",
			},
			wantLayer:     "cluster",
			wantComponent: "kube-apiserver",
		},
		{
			name: "monitoring namespace",
			labels: model.LabelSet{
				"namespace": "openshift-monitoring",
				model.LabelName(managementlabels.AlertNameLabel): "PrometheusDown",
			},
			wantLayer:     "cluster",
			wantComponent: "monitoring",
		},
		{
			name: "monitoring-operator namespace",
			labels: model.LabelSet{
				"namespace": "openshift-monitoring-operator",
				model.LabelName(managementlabels.AlertNameLabel): "SomeAlert",
			},
			wantLayer:     "cluster",
			wantComponent: "monitoring",
		},
		{
			name: "machine-config by alert name",
			labels: model.LabelSet{
				model.LabelName(managementlabels.AlertNameLabel): "KubeletHealthState",
			},
			wantLayer:     "cluster",
			wantComponent: "machine-config",
		},
		{
			name: "version by alert name",
			labels: model.LabelSet{
				model.LabelName(managementlabels.AlertNameLabel): "ClusterNotUpgradeable",
			},
			wantLayer:     "cluster",
			wantComponent: "version",
		},
		{
			name: "ingress namespace",
			labels: model.LabelSet{
				"namespace": "openshift-ingress",
				model.LabelName(managementlabels.AlertNameLabel): "IngressDown",
			},
			wantLayer:     "cluster",
			wantComponent: "ingress",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			layer, component := DetermineComponent(tt.labels)
			if layer != tt.wantLayer {
				t.Errorf("layer = %q, want %q", layer, tt.wantLayer)
			}
			if component != tt.wantComponent {
				t.Errorf("component = %q, want %q", component, tt.wantComponent)
			}
		})
	}
}

func TestDetermineComponent_WorkloadComponents(t *testing.T) {
	tests := []struct {
		name          string
		labels        model.LabelSet
		wantLayer     string
		wantComponent string
	}{
		{
			name: "openshift-logging",
			labels: model.LabelSet{
				"namespace": "openshift-logging",
				model.LabelName(managementlabels.AlertNameLabel): "FluentdDown",
			},
			wantLayer:     "namespace",
			wantComponent: "openshift-logging",
		},
		{
			name: "user workload monitoring",
			labels: model.LabelSet{
				"namespace": UserWorkloadMonitoringNamespace,
				model.LabelName(managementlabels.AlertNameLabel): "SomeAlert",
			},
			wantLayer:     "namespace",
			wantComponent: "openshift-user-workload-monitoring",
		},
		{
			name: "quay by container label",
			labels: model.LabelSet{
				"container": "quay-app",
				model.LabelName(managementlabels.AlertNameLabel): "QuayDown",
			},
			wantLayer:     "namespace",
			wantComponent: "quay",
		},
		{
			name: "Argo alert name regex",
			labels: model.LabelSet{
				model.LabelName(managementlabels.AlertNameLabel): "ArgoWorkflowFailed",
			},
			wantLayer:     "namespace",
			wantComponent: "Argo",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			layer, component := DetermineComponent(tt.labels)
			if layer != tt.wantLayer {
				t.Errorf("layer = %q, want %q", layer, tt.wantLayer)
			}
			if component != tt.wantComponent {
				t.Errorf("component = %q, want %q", component, tt.wantComponent)
			}
		})
	}
}

func TestDetermineComponent_CVO(t *testing.T) {
	tests := []struct {
		name          string
		labels        model.LabelSet
		wantLayer     string
		wantComponent string
	}{
		{
			name: "ClusterOperatorDown with name",
			labels: model.LabelSet{
				model.LabelName(managementlabels.AlertNameLabel): "ClusterOperatorDown",
				"name": "etcd",
			},
			wantLayer:     "cluster",
			wantComponent: "etcd",
		},
		{
			name: "ClusterOperatorDegraded with name",
			labels: model.LabelSet{
				model.LabelName(managementlabels.AlertNameLabel): "ClusterOperatorDegraded",
				"name": "monitoring",
			},
			wantLayer:     "cluster",
			wantComponent: "monitoring",
		},
		{
			name: "ClusterOperatorDown without name falls back to version",
			labels: model.LabelSet{
				model.LabelName(managementlabels.AlertNameLabel): "ClusterOperatorDown",
			},
			wantLayer:     "cluster",
			wantComponent: "version",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			layer, component := DetermineComponent(tt.labels)
			if layer != tt.wantLayer {
				t.Errorf("layer = %q, want %q", layer, tt.wantLayer)
			}
			if component != tt.wantComponent {
				t.Errorf("component = %q, want %q", component, tt.wantComponent)
			}
		})
	}
}

func TestDetermineComponent_KubevirtOperator(t *testing.T) {
	tests := []struct {
		name          string
		labels        model.LabelSet
		wantLayer     string
		wantComponent string
	}{
		{
			name: "kubevirt VM alert",
			labels: model.LabelSet{
				"kubernetes_operator_part_of":                    "kubevirt",
				"kubernetes_operator_component":                  "kubevirt",
				"operator_health_impact":                         "none",
				model.LabelName(managementlabels.AlertNameLabel): "VMDown",
			},
			wantLayer:     "namespace",
			wantComponent: "OpenShift Virtualization Virtual Machine",
		},
		{
			name: "kubevirt operator alert",
			labels: model.LabelSet{
				"kubernetes_operator_part_of":                    "kubevirt",
				"kubernetes_operator_component":                  "virt-operator",
				"operator_health_impact":                         "critical",
				model.LabelName(managementlabels.AlertNameLabel): "VirtOperatorDown",
			},
			wantLayer:     "cluster",
			wantComponent: "OpenShift Virtualization Operator",
		},
		{
			name: "cnv-observability skipped",
			labels: model.LabelSet{
				"kubernetes_operator_part_of":                    "kubevirt",
				"kubernetes_operator_component":                  "cnv-observability",
				"namespace":                                      "openshift-monitoring",
				model.LabelName(managementlabels.AlertNameLabel): "MonitoringAlert",
			},
			wantLayer:     "cluster",
			wantComponent: "monitoring",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			layer, component := DetermineComponent(tt.labels)
			if layer != tt.wantLayer {
				t.Errorf("layer = %q, want %q", layer, tt.wantLayer)
			}
			if component != tt.wantComponent {
				t.Errorf("component = %q, want %q", component, tt.wantComponent)
			}
		})
	}
}

func TestDetermineComponent_Compute(t *testing.T) {
	tests := []struct {
		name          string
		labels        model.LabelSet
		wantLayer     string
		wantComponent string
	}{
		{
			name: "node alert",
			labels: model.LabelSet{
				model.LabelName(managementlabels.AlertNameLabel): "KubeNodeNotReady",
			},
			wantLayer:     "cluster",
			wantComponent: "compute",
		},
		{
			name: "node filesystem alert",
			labels: model.LabelSet{
				model.LabelName(managementlabels.AlertNameLabel): "NodeFilesystemSpaceFillingUp",
			},
			wantLayer:     "cluster",
			wantComponent: "compute",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			layer, component := DetermineComponent(tt.labels)
			if layer != tt.wantLayer {
				t.Errorf("layer = %q, want %q", layer, tt.wantLayer)
			}
			if component != tt.wantComponent {
				t.Errorf("component = %q, want %q", component, tt.wantComponent)
			}
		})
	}
}

func TestDetermineComponent_Fallback(t *testing.T) {
	labels := model.LabelSet{
		model.LabelName(managementlabels.AlertNameLabel): "CustomAlert",
		"namespace": "my-app",
	}
	layer, component := DetermineComponent(labels)
	if layer != "Others" {
		t.Errorf("layer = %q, want %q", layer, "Others")
	}
	if component != "Others" {
		t.Errorf("component = %q, want %q", component, "Others")
	}
}

func TestStringMatcher(t *testing.T) {
	m := NewStringValuesMatcher("a", "b", "c")

	if !m.Matches("a") {
		t.Error("expected 'a' to match")
	}
	if !m.Matches("c") {
		t.Error("expected 'c' to match")
	}
	if m.Matches("d") {
		t.Error("expected 'd' not to match")
	}
	if m.Matches("") {
		t.Error("expected empty string not to match")
	}
}

func TestRegexpMatcher(t *testing.T) {
	m := NewRegexValuesMatcher(regexp.MustCompile("^Argo"), regexp.MustCompile("^Kube"))

	if !m.Matches("ArgoWorkflow") {
		t.Error("expected 'ArgoWorkflow' to match")
	}
	if !m.Matches("KubeNodeNotReady") {
		t.Error("expected 'KubeNodeNotReady' to match")
	}
	if m.Matches("PrometheusDown") {
		t.Error("expected 'PrometheusDown' not to match")
	}
}

func TestLabelsMatcher(t *testing.T) {
	m := NewLabelsMatcher("namespace", NewStringValuesMatcher("openshift-etcd", "openshift-monitoring"))

	match, keys := m.Matches(model.LabelSet{"namespace": "openshift-etcd"})
	if !match {
		t.Error("expected match for openshift-etcd")
	}
	if len(keys) != 1 || keys[0] != "namespace" {
		t.Errorf("unexpected keys: %v", keys)
	}

	match, _ = m.Matches(model.LabelSet{"namespace": "default"})
	if match {
		t.Error("expected no match for default namespace")
	}

	match, _ = m.Matches(model.LabelSet{})
	if match {
		t.Error("expected no match for empty labels")
	}
}

func TestEqualsNoOrder(t *testing.T) {
	tests := []struct {
		name string
		a, b []string
		want bool
	}{
		{"same order", []string{"a", "b"}, []string{"a", "b"}, true},
		{"different order", []string{"b", "a"}, []string{"a", "b"}, true},
		{"different length", []string{"a"}, []string{"a", "b"}, false},
		{"different values", []string{"a", "c"}, []string{"a", "b"}, false},
		{"empty slices", []string{}, []string{}, true},
		{"duplicates", []string{"a", "a"}, []string{"a", "a"}, true},
		{"mismatched duplicates", []string{"a", "a"}, []string{"a", "b"}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := equalsNoOrder(tt.a, tt.b); got != tt.want {
				t.Errorf("equalsNoOrder(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestValueMatcherEquals(t *testing.T) {
	s1 := NewStringValuesMatcher("a", "b")
	s2 := NewStringValuesMatcher("b", "a")
	s3 := NewStringValuesMatcher("a", "c")

	if !s1.Equals(s2) {
		t.Error("expected s1 to equal s2 (order-independent)")
	}
	if s1.Equals(s3) {
		t.Error("expected s1 not to equal s3")
	}

	r1 := NewRegexValuesMatcher(regexp.MustCompile("^Argo"))
	if s1.Equals(r1) {
		t.Error("expected string matcher not to equal regexp matcher")
	}
}
