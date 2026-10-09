package management

import (
	"encoding/json"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
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

func prometheusRuleDesiredObject(pr *monitoringv1.PrometheusRule) (map[string]any, error) {
	if pr == nil {
		return nil, nil
	}
	return objectToMap(pr.DeepCopy())
}

func buildDesiredPrometheusRuleWithRule(
	pr *monitoringv1.PrometheusRule,
	groupIdx, ruleIdx int,
	desiredRule monitoringv1.Rule,
) *monitoringv1.PrometheusRule {
	out := pr.DeepCopy()
	out.Spec.Groups[groupIdx].Rules[ruleIdx] = desiredRule
	return out
}

func buildDesiredPrometheusRuleWithAddedRule(
	pr *monitoringv1.PrometheusRule,
	groupName string,
	groupIdx int,
	newRule monitoringv1.Rule,
) *monitoringv1.PrometheusRule {
	if pr != nil {
		out := pr.DeepCopy()
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
		Spec: monitoringv1.PrometheusRuleSpec{
			Groups: []monitoringv1.RuleGroup{{
				Name:  groupName,
				Rules: []monitoringv1.Rule{newRule},
			}},
		},
	}
}

func alertingRuleDesiredObject(ar *osmv1.AlertingRule) (map[string]any, error) {
	if ar == nil {
		return nil, nil
	}
	return objectToMap(ar.DeepCopy())
}

func buildDesiredAlertingRuleWithUpdatedLabels(
	ar *osmv1.AlertingRule,
	alertName string,
	desiredLabels map[string]string,
) (*osmv1.AlertingRule, error) {
	out := ar.DeepCopy()
	target, found := findAlertByNameInAlertingRule(out, alertName)
	if !found || target == nil {
		return nil, &NotFoundError{Resource: "AlertRule", AdditionalInfo: "alert not found in AlertingRule"}
	}
	if len(desiredLabels) == 0 {
		target.Labels = nil
	} else {
		target.Labels = copyStringMap(desiredLabels)
	}
	return out, nil
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
		Spec: osmv1.AlertingRuleSpec{
			Groups: []osmv1.RuleGroup{{
				Name:  groupName,
				Rules: []osmv1.Rule{newRule},
			}},
		},
	}
}

func alertRelabelConfigDesiredObject(arc *osmv1.AlertRelabelConfig) (map[string]any, error) {
	if arc == nil {
		return nil, nil
	}
	return objectToMap(arc)
}
