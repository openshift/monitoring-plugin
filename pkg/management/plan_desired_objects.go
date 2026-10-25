package management

import (
	"encoding/json"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func objectToMap(obj any) (map[string]any, error) {
	data, err := json.Marshal(obj)
	if err != nil {
		return nil, err
	}
	out := map[string]any{}
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func prometheusRuleToObject(pr *monitoringv1.PrometheusRule) (map[string]any, error) {
	if pr == nil {
		return nil, nil
	}
	out := pr.DeepCopy()
	// Typed-client GETs clear TypeMeta; restore it so desiredObject is a
	// complete Kubernetes object.
	out.TypeMeta = metav1.TypeMeta{APIVersion: prometheusRuleAPIVersion, Kind: prometheusRuleKind}
	return objectToMap(out)
}

func buildDesiredPrometheusRuleWithUpdatedRule(
	pr *monitoringv1.PrometheusRule,
	groupIdx, ruleIdx int,
	desiredRule monitoringv1.Rule,
) *monitoringv1.PrometheusRule {
	out := pr.DeepCopy()
	out.Spec.Groups[groupIdx].Rules[ruleIdx] = desiredRule
	return out
}

func buildDesiredPrometheusRuleWithAddedRule(
	existingPR *monitoringv1.PrometheusRule,
	groupName string,
	groupIdx int,
	newRule monitoringv1.Rule,
) *monitoringv1.PrometheusRule {
	if existingPR != nil {
		out := existingPR.DeepCopy()
		if groupIdx < len(out.Spec.Groups) {
			out.Spec.Groups[groupIdx].Rules = append(out.Spec.Groups[groupIdx].Rules, newRule)
			return out
		}
		out.Spec.Groups = append(out.Spec.Groups, monitoringv1.RuleGroup{
			Name:  groupName,
			Rules: []monitoringv1.Rule{newRule},
		})
		return out
	}
	return &monitoringv1.PrometheusRule{
		TypeMeta: metav1.TypeMeta{
			APIVersion: prometheusRuleAPIVersion,
			Kind:       prometheusRuleKind,
		},
		Spec: monitoringv1.PrometheusRuleSpec{
			Groups: []monitoringv1.RuleGroup{{
				Name:  groupName,
				Rules: []monitoringv1.Rule{newRule},
			}},
		},
	}
}

func alertingRuleToObject(ar *osmv1.AlertingRule) (map[string]any, error) {
	if ar == nil {
		return nil, nil
	}
	out := ar.DeepCopy()
	// Typed-client GETs clear TypeMeta; restore it so desiredObject is a
	// complete Kubernetes object.
	out.TypeMeta = metav1.TypeMeta{APIVersion: alertingRuleAPIVersion, Kind: alertingRuleKind}
	return objectToMap(out)
}

func buildDesiredAlertingRuleWithUpdatedLabels(
	ar *osmv1.AlertingRule,
	groupIdx, alertIdx int,
	desiredLabels map[string]string,
) *osmv1.AlertingRule {
	out := ar.DeepCopy()
	target := &out.Spec.Groups[groupIdx].Rules[alertIdx]
	if len(desiredLabels) == 0 {
		target.Labels = nil
	} else {
		target.Labels = copyStringMap(desiredLabels)
	}
	return out
}

func buildDesiredAlertingRuleWithAddedRule(
	ar *osmv1.AlertingRule,
	groupName string,
	groupIdx int,
	newRule osmv1.Rule,
) *osmv1.AlertingRule {
	if ar != nil {
		out := ar.DeepCopy()
		if groupIdx < len(out.Spec.Groups) {
			out.Spec.Groups[groupIdx].Rules = append(out.Spec.Groups[groupIdx].Rules, newRule)
			return out
		}
		out.Spec.Groups = append(out.Spec.Groups, osmv1.RuleGroup{
			Name:  groupName,
			Rules: []osmv1.Rule{newRule},
		})
		return out
	}
	return &osmv1.AlertingRule{
		TypeMeta: metav1.TypeMeta{
			APIVersion: alertingRuleAPIVersion,
			Kind:       alertingRuleKind,
		},
		Spec: osmv1.AlertingRuleSpec{
			Groups: []osmv1.RuleGroup{{
				Name:  groupName,
				Rules: []osmv1.Rule{newRule},
			}},
		},
	}
}

func alertRelabelConfigToObject(arc *osmv1.AlertRelabelConfig) (map[string]any, error) {
	if arc == nil {
		return nil, nil
	}
	out := arc.DeepCopy()
	// Typed-client GETs clear TypeMeta; restore it so desiredObject is a
	// complete Kubernetes object.
	out.TypeMeta = metav1.TypeMeta{APIVersion: alertRelabelConfigAPIVersion, Kind: alertRelabelConfigKind}
	return objectToMap(out)
}
