package alertcomponent

import (
	"regexp"
	"slices"

	"github.com/prometheus/common/model"

	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

const (
	labelNamespace = "namespace"
	labelSeverity  = "severity"

	// ClusterMonitoringNamespace is the namespace for the platform monitoring stack.
	ClusterMonitoringNamespace = "openshift-monitoring"
	// UserWorkloadMonitoringNamespace is the namespace for user workload monitoring.
	UserWorkloadMonitoringNamespace = "openshift-user-workload-monitoring"
)

func namespaceMatcher(values ...string) LabelsMatcher {
	return NewLabelsMatcher(labelNamespace, NewStringValuesMatcher(values...))
}

func alertNameMatcher(values ...string) LabelsMatcher {
	return NewLabelsMatcher(managementlabels.AlertNameLabel, NewStringValuesMatcher(values...))
}

func regexAlertNameMatcher(regexes ...*regexp.Regexp) LabelsMatcher {
	return NewLabelsMatcher(managementlabels.AlertNameLabel, NewRegexValuesMatcher(regexes...))
}

func labelValueMatcher(key string, values ...string) LabelsMatcher {
	return NewLabelsMatcher(key, NewStringValuesMatcher(values...))
}

func componentRule(component string, ms ...LabelsMatcher) componentMatcher {
	return componentMatcher{component: component, matchers: ms}
}

// LabelsMatcher represents a matcher definition for a set of labels.
// It matches if all of the label matchers match the labels.
type LabelsMatcher interface {
	Matches(labels model.LabelSet) (match bool, keys []model.LabelName)
	Equals(other LabelsMatcher) bool
}

func NewLabelsMatcher(key string, matcher ValueMatcher) LabelsMatcher {
	return labelMatcher{key: key, matcher: matcher}
}

func NewStringValuesMatcher(keys ...string) ValueMatcher {
	return stringMatcher(keys)
}

func NewRegexValuesMatcher(regexes ...*regexp.Regexp) ValueMatcher {
	return regexpMatcher(regexes)
}

// labelMatcher represents a matcher definition for a label.
type labelMatcher struct {
	key     string
	matcher ValueMatcher
}

// Matches implements the LabelsMatcher interface.
func (l labelMatcher) Matches(labels model.LabelSet) (bool, []model.LabelName) {
	if l.matcher.Matches(string(labels[model.LabelName(l.key)])) {
		return true, []model.LabelName{model.LabelName(l.key)}
	}
	return false, nil
}

// Equals implements the LabelsMatcher interface.
func (l labelMatcher) Equals(other LabelsMatcher) bool {
	ol, ok := other.(labelMatcher)
	if !ok {
		return false
	}
	return l.key == ol.key && l.matcher.Equals(ol.matcher)
}

// ValueMatcher represents a matcher for a specific value.
//
// Multiple implementations are provided for different types of matchers.
type ValueMatcher interface {
	Matches(value string) bool
	Equals(other ValueMatcher) bool
}

// stringMatcher is a matcher for a list of strings.
//
// It matches if the value is in the list of strings.
type stringMatcher []string

func (s stringMatcher) Matches(value string) bool {
	return slices.Contains(s, value)
}

// Equals implements the ValueMatcher interface.
func (s stringMatcher) Equals(other ValueMatcher) bool {
	o, ok := other.(stringMatcher)
	if !ok {
		return false
	}
	return equalsNoOrder(s, o)
}

// regexpMatcher is a matcher for a list of regular expressions.
//
// It matches if the value matches any of the regular expressions.
type regexpMatcher []*regexp.Regexp

func (r regexpMatcher) Matches(value string) bool {
	for _, re := range r {
		if re.MatchString(value) {
			return true
		}
	}
	return false
}

// Equals implements the ValueMatcher interface.
func (r regexpMatcher) Equals(other ValueMatcher) bool {
	o, ok := other.(regexpMatcher)
	if !ok {
		return false
	}
	s1 := make([]string, 0, len(r))
	for _, re := range r {
		s1 = append(s1, re.String())
	}
	s2 := make([]string, 0, len(o))
	for _, re := range o {
		s2 = append(s2, re.String())
	}
	return equalsNoOrder(s1, s2)
}

func equalsNoOrder(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}

	seen := make(map[string]int, len(a))
	for _, v := range a {
		seen[v]++
	}
	for _, v := range b {
		if seen[v] == 0 {
			return false
		}
		seen[v]--
	}
	return true
}

// componentMatcher represents a matcher definition for a component.
//
// It matches if any of the label matchers match the labels.
type componentMatcher struct {
	component string
	matchers  []LabelsMatcher
}

// findComponent tries to determine a component for given labels using the provided matchers.
//
// It returns the component and the keys that matched.
// If no match is found, it returns an empty component and nil keys.
func findComponent(compMatchers []componentMatcher, labels model.LabelSet) (
	component string, keys []model.LabelName) {
	for _, compMatcher := range compMatchers {
		for _, labelsMatcher := range compMatcher.matchers {
			if matches, keys := labelsMatcher.Matches(labels); matches {
				return compMatcher.component, keys
			}
		}
	}
	return "", nil
}

// componentMatcherFn is a function that tries matching provided labels to a component.
// It returns the layer, component and the keys from the labels that were used for matching.
// If no match is found, it returns an empty layer, component and nil keys.
type componentMatcherFn func(labels model.LabelSet) (layer, comp model.LabelValue, keys []model.LabelName)

func evalMatcherFns(fns []componentMatcherFn, labels model.LabelSet) (
	layer, comp string, labelsSubset model.LabelSet) {
	for _, fn := range fns {
		if layer, comp, keys := fn(labels); layer != "" {
			return string(layer), string(comp), getLabelsSubset(labels, keys...)
		}
	}
	return "Others", "Others", getLabelsSubset(labels)
}

// getLabelsSubset returns a subset of the labels with given keys.
func getLabelsSubset(m model.LabelSet, keys ...model.LabelName) model.LabelSet {
	keys = append([]model.LabelName{
		model.LabelName(labelNamespace),
		model.LabelName(managementlabels.AlertNameLabel),
		model.LabelName(labelSeverity),
	}, keys...)
	return getMapSubset(m, keys...)
}

// getMapSubset returns a subset of the labels with given keys.
func getMapSubset(m model.LabelSet, keys ...model.LabelName) model.LabelSet {
	subset := make(model.LabelSet, len(keys))
	for _, key := range keys {
		if val, ok := m[key]; ok {
			subset[key] = val
		}
	}
	return subset
}

var (
	nodeAlerts []model.LabelValue = []model.LabelValue{
		"NodeClockNotSynchronising",
		"KubeNodeNotReady",
		"KubeNodeUnreachable",
		"NodeSystemSaturation",
		"NodeFilesystemSpaceFillingUp",
		"NodeFilesystemAlmostOutOfSpace",
		"NodeMemoryMajorPagesFaults",
		"NodeNetworkTransmitErrs",
		"NodeTextFileCollectorScrapeError",
		"NodeFilesystemFilesFillingUp",
		"NodeNetworkReceiveErrs",
		"NodeClockSkewDetected",
		"NodeFilesystemAlmostOutOfFiles",
		"NodeWithoutOVNKubeNodePodRunning",
		"InfraNodesNeedResizingSRE",
		"NodeHighNumberConntrackEntriesUsed",
		"NodeMemHigh",
		"NodeNetworkInterfaceFlapping",
		"NodeWithoutSDNPod",
		"NodeCpuHigh",
		"CriticalNodeNotReady",
		"NodeFileDescriptorLimit",
		"MCCPoolAlert",
		"MCCDrainError",
		"MCDRebootError",
		"MCDPivotError",
	}

	coreMatchers = []componentMatcher{
		componentRule("etcd", namespaceMatcher("openshift-etcd", "openshift-etcd-operator")),
		componentRule("kube-apiserver", namespaceMatcher("openshift-kube-apiserver", "openshift-kube-apiserver-operator")),
		componentRule("kube-controller-manager", namespaceMatcher("openshift-kube-controller-manager", "openshift-kube-controller-manager-operator", "kube-system")),
		componentRule("kube-scheduler", namespaceMatcher("openshift-kube-scheduler", "openshift-kube-scheduler-operator")),
		componentRule("machine-approver", namespaceMatcher("openshift-cluster-machine-approver", "openshift-machine-approver-operator")),
		componentRule("machine-config",
			namespaceMatcher("openshift-machine-config-operator"),
			alertNameMatcher(
				"HighOverallControlPlaneMemory",
				"ExtremelyHighIndividualControlPlaneMemory",
				"MissingMachineConfig",
				"MCCBootImageUpdateError",
				"KubeletHealthState",
				"SystemMemoryExceedsReservation",
			),
		),
		componentRule("version",
			namespaceMatcher("openshift-cluster-version", "openshift-version-operator"),
			alertNameMatcher("ClusterNotUpgradeable", "UpdateAvailable"),
		),
		componentRule("dns", namespaceMatcher("openshift-dns", "openshift-dns-operator")),
		componentRule("authentication", namespaceMatcher("openshift-authentication", "openshift-oauth-apiserver", "openshift-authentication-operator")),
		componentRule("cert-manager", namespaceMatcher("openshift-cert-manager", "openshift-cert-manager-operator")),
		componentRule("cloud-controller-manager", namespaceMatcher("openshift-cloud-controller-manager", "openshift-cloud-controller-manager-operator")),
		componentRule("cloud-credential", namespaceMatcher("openshift-cloud-credential-operator")),
		componentRule("cluster-api", namespaceMatcher("openshift-cluster-api", "openshift-cluster-api-operator")),
		componentRule("config-operator", namespaceMatcher("openshift-config-operator")),
		componentRule("kube-storage-version-migrator", namespaceMatcher("openshift-kube-storage-version-migrator", "openshift-kube-storage-version-migrator-operator")),
		componentRule("image-registry", namespaceMatcher("openshift-image-registry", "openshift-image-registry-operator")),
		componentRule("ingress", namespaceMatcher("openshift-ingress", "openshift-route-controller-manager", "openshift-ingress-canary", "openshift-ingress-operator")),
		componentRule("console", namespaceMatcher("openshift-console", "openshift-console-operator")),
		componentRule("insights", namespaceMatcher("openshift-insights", "openshift-insights-operator")),
		componentRule("machine-api", namespaceMatcher("openshift-machine-api", "openshift-machine-api-operator")),
		componentRule("monitoring", namespaceMatcher(ClusterMonitoringNamespace, "openshift-monitoring-operator")),
		componentRule("network", namespaceMatcher("openshift-network-operator", "openshift-ovn-kubernetes", "openshift-multus", "openshift-network-diagnostics", "openshift-sdn")),
		componentRule("node-tuning", namespaceMatcher("openshift-cluster-node-tuning-operator", "openshift-node-tuning-operator")),
		componentRule("openshift-apiserver", namespaceMatcher("openshift-apiserver", "openshift-apiserver-operator")),
		componentRule("openshift-controller-manager", namespaceMatcher("openshift-controller-manager", "openshift-controller-manager-operator")),
		componentRule("openshift-samples", namespaceMatcher("openshift-cluster-samples-operator", "openshift-samples-operator")),
		componentRule("operator-lifecycle-manager", namespaceMatcher("openshift-operator-lifecycle-manager")),
		componentRule("service-ca", namespaceMatcher("openshift-service-ca", "openshift-service-ca-operator")),
		componentRule("storage", namespaceMatcher("openshift-storage", "openshift-cluster-csi-drivers", "openshift-cluster-storage-operator", "openshift-storage-operator")),
		componentRule("vertical-pod-autoscaler", namespaceMatcher("openshift-vertical-pod-autoscaler", "openshift-vertical-pod-autoscaler-operator")),
		componentRule("marketplace", namespaceMatcher("openshift-marketplace", "openshift-marketplace-operator")),
	}

	workloadMatchers = []componentMatcher{
		componentRule("openshift-compliance", namespaceMatcher("openshift-compliance")),
		componentRule("openshift-file-integrity", namespaceMatcher("openshift-file-integrity")),
		componentRule("openshift-logging", namespaceMatcher("openshift-logging")),
		componentRule("openshift-user-workload-monitoring", namespaceMatcher(UserWorkloadMonitoringNamespace)),
		componentRule("openshift-gitops", namespaceMatcher("openshift-gitops", "openshift-gitops-operator")),
		componentRule("openshift-operators", namespaceMatcher("openshift-operators")),
		componentRule("openshift-local-storage", namespaceMatcher("openshift-local-storage")),
		componentRule("quay", labelValueMatcher("container", "quay-app", "quay-mirror", "quay-app-upgrade")),
		componentRule("Argo", regexAlertNameMatcher(regexp.MustCompile("^Argo"))),
	}
)

var cvoAlerts = []model.LabelValue{"ClusterOperatorDown", "ClusterOperatorDegraded"}

func cvoAlertsMatcher(labels model.LabelSet) (layer, comp model.LabelValue, keys []model.LabelName) {
	if slices.Contains(cvoAlerts, labels[managementlabels.AlertNameLabel]) {
		component := labels["name"]
		if component == "" {
			component = "version"
		}
		return "cluster", component, nil
	}
	return "", "", nil
}

func kubevirtOperatorMatcher(labels model.LabelSet) (layer, comp model.LabelValue, keys []model.LabelName) {
	if labels["kubernetes_operator_part_of"] != "kubevirt" {
		return "", "", nil
	}
	if labels["kubernetes_operator_component"] == "cnv-observability" {
		return "", "", nil
	}
	if labels["operator_health_impact"] == "none" && labels["kubernetes_operator_component"] == "kubevirt" {
		return "namespace", "OpenShift Virtualization Virtual Machine", []model.LabelName{
			"kubernetes_operator_part_of",
			"kubernetes_operator_component",
			"operator_health_impact",
		}
	}
	return "cluster", "OpenShift Virtualization Operator", []model.LabelName{
		"kubernetes_operator_part_of",
		"kubernetes_operator_component",
		"operator_health_impact",
	}
}

func computeMatcher(labels model.LabelSet) (layer, comp model.LabelValue, keys []model.LabelName) {
	if slices.Contains(nodeAlerts, labels[managementlabels.AlertNameLabel]) {
		return "cluster", "compute", nil
	}
	return "", "", nil
}

func coreMatcher(labels model.LabelSet) (layer, comp model.LabelValue, keys []model.LabelName) {
	// Try matching against core components.
	if component, keys := findComponent(coreMatchers, labels); component != "" {
		return "cluster", model.LabelValue(component), keys
	}
	return "", "", nil
}

func workloadMatcher(labels model.LabelSet) (layer, comp model.LabelValue, keys []model.LabelName) {
	// Try matching against workload components.
	if component, keys := findComponent(workloadMatchers, labels); component != "" {
		return "namespace", model.LabelValue(component), keys
	}
	return "", "", nil
}

// DetermineComponent determines the component for a given set of labels.
// It returns the layer and component strings.
func DetermineComponent(labels model.LabelSet) (layer, component string) {
	layer, component, _ = evalMatcherFns([]componentMatcherFn{
		cvoAlertsMatcher,
		kubevirtOperatorMatcher,
		computeMatcher,
		coreMatcher,
		workloadMatcher,
	}, labels)
	return layer, component
}
