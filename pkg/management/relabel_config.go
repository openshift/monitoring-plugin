package management

import (
	"fmt"

	osmv1 "github.com/openshift/api/monitoring/v1"
)

// applyRelabelConfigs applies relabel configurations to a set of labels.
// Returns the updated labels or an error if the alert/rule should be dropped.
func applyRelabelConfigs(name string, labels map[string]string, configs []osmv1.RelabelConfig) (map[string]string, error) {
	if labels == nil {
		labels = make(map[string]string)
	}

	updatedLabels := make(map[string]string, len(labels))
	for k, v := range labels {
		updatedLabels[k] = v
	}

	for _, config := range configs {
		// TODO: (machadovilaca) Implement all relabeling actions
		// 'Replace', 'Keep', 'Drop', 'HashMod', 'LabelMap', 'LabelDrop', or 'LabelKeep'

		switch config.Action {
		case "Drop":
			return nil, fmt.Errorf("alert/rule %s has been dropped by relabeling configuration", name)
		case "Replace":
			updatedLabels[config.TargetLabel] = config.Replacement
		case "Keep":
			// Keep action is a no-op in this context since the alert/rule is already matched
		case "HashMod":
			// HashMod action is not implemented yet
		case "LabelMap":
			// LabelMap action is not implemented yet
		case "LabelDrop":
			// LabelDrop action is not implemented yet
		case "LabelKeep":
			// LabelKeep action is not implemented yet
		default:
			// Unsupported action, ignore
		}
	}

	return updatedLabels, nil
}
