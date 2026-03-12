package managementrouter

import (
	"encoding/json"
	"net/http"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/openshift/monitoring-plugin/pkg/management"
)

// CreateAlertRule implements ServerInterface.
func (hr *httpRouter) CreateAlertRule(w http.ResponseWriter, req *http.Request) {
	req.Body = http.MaxBytesReader(w, req.Body, maxRequestBodyBytes)

	var payload CreateAlertRuleRequest
	if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if payload.AlertingRule == nil {
		writeError(w, http.StatusBadRequest, "alertingRule is required")
		return
	}

	alertRule := alertRuleSpecToMonitoringV1(*payload.AlertingRule)

	var (
		id  string
		err error
	)

	if payload.PrometheusRule != nil {
		prOpts := prometheusRuleTargetToOptions(*payload.PrometheusRule)
		id, err = hr.managementClient.CreateUserDefinedAlertRule(req.Context(), alertRule, prOpts)
	} else {
		id, err = hr.managementClient.CreatePlatformAlertRule(req.Context(), alertRule)
	}

	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(CreateAlertRuleResponse{Id: id}); err != nil {
		log.WithError(err).Warn("failed to encode create alert rule response")
	}
}

// alertRuleSpecToMonitoringV1 maps the API-defined AlertRuleSpec to the
// prometheus-operator Rule type used by the management layer.
func alertRuleSpecToMonitoringV1(spec AlertRuleSpec) monitoringv1.Rule {
	rule := monitoringv1.Rule{}

	if spec.Alert != nil {
		rule.Alert = *spec.Alert
	}
	if spec.Record != nil {
		rule.Record = *spec.Record
	}
	if spec.Expr != nil {
		rule.Expr = intstr.FromString(*spec.Expr)
	}
	if spec.For != nil {
		d := monitoringv1.Duration(*spec.For)
		rule.For = &d
	}
	if spec.KeepFiringFor != nil {
		d := monitoringv1.NonEmptyDuration(*spec.KeepFiringFor)
		rule.KeepFiringFor = &d
	}
	if spec.Labels != nil {
		rule.Labels = *spec.Labels
	}
	if spec.Annotations != nil {
		rule.Annotations = *spec.Annotations
	}

	return rule
}

// prometheusRuleTargetToOptions maps the API-defined PrometheusRuleTarget to
// the management layer's PrometheusRuleOptions.
func prometheusRuleTargetToOptions(target PrometheusRuleTarget) management.PrometheusRuleOptions {
	opts := management.PrometheusRuleOptions{
		Name:      target.PrometheusRuleName,
		Namespace: target.PrometheusRuleNamespace,
	}
	if target.GroupName != nil {
		opts.GroupName = *target.GroupName
	}
	return opts
}
