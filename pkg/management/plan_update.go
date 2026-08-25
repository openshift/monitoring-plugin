package management

import (
	"context"
	"fmt"
	"strings"

	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/openshift/monitoring-plugin/pkg/classification"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
)

// PreviewUpdateRequest holds update mutation fields for preview planning.
type PreviewUpdateRequest struct {
	RuleID              string
	Labels              map[string]*string
	AlertingRuleEnabled *bool
	Classification      *UpdateRuleClassificationRequest
}

func (c *client) planUpdateAlertRule(ctx context.Context, req PreviewUpdateRequest) (*RuleChangePlan, error) {
	if req.RuleID == "" {
		return nil, &ValidationError{Message: "ruleId is required"}
	}

	hasLabels := req.Labels != nil
	hasClassification := req.Classification != nil &&
		(req.Classification.ComponentSet ||
			req.Classification.LayerSet ||
			req.Classification.ComponentFromSet ||
			req.Classification.LayerFromSet)
	hasEnabled := req.AlertingRuleEnabled != nil

	if !hasLabels && !hasClassification && !hasEnabled {
		return nil, &ValidationError{
			Message: "one of alertingRuleEnabled (toggle drop/restore) or labels (set/unset) or classification is required",
		}
	}
	if hasEnabled && (hasLabels || hasClassification) {
		return nil, &ValidationError{
			Message: "alertingRuleEnabled cannot be combined with labels or classification in the same request",
		}
	}
	if req.Classification != nil && !hasClassification && !hasLabels && !hasEnabled {
		return nil, &ValidationError{Message: "classification must set at least one field"}
	}

	if hasEnabled {
		return c.planDropRestoreChange(ctx, req.RuleID, *req.AlertingRuleEnabled)
	}

	classLabels := map[string]string{}
	if hasClassification {
		if err := validatePreviewClassificationRequest(*req.Classification); err != nil {
			return nil, err
		}
		classLabels = buildClassificationLabels(*req.Classification)
	}

	userLabels := map[string]string{}
	if hasLabels {
		for k, pv := range req.Labels {
			if pv == nil || *pv == "" {
				userLabels[k] = ""
			} else {
				userLabels[k] = *pv
			}
		}
	}

	relabeled, found := c.k8sClient.RelabeledRules().Get(ctx, req.RuleID)
	if !found {
		return nil, &NotFoundError{Resource: "AlertRule", Id: req.RuleID}
	}

	namespace := relabeled.Labels[k8s.PrometheusRuleLabelNamespace]
	name := relabeled.Labels[k8s.PrometheusRuleLabelName]
	nn := types.NamespacedName{Namespace: namespace, Name: name}

	if hasClassification && !c.isPlatformManagedPrometheusRule(nn) {
		return nil, &NotAllowedError{Message: "classification updates are only supported for platform alert rules"}
	}

	if c.isPlatformManagedPrometheusRule(nn) {
		return c.planPlatformUpdate(ctx, req.RuleID, relabeled, classLabels, userLabels)
	}

	merged := mergeLabelMaps(copyStringMap(userLabels), classLabels)
	return c.planUserDefinedLabelUpdate(ctx, req.RuleID, relabeled, merged)
}

func applyUserDefinedLabelMap(userLabels map[string]string, rawLabels map[string]string) error {
	for k, v := range rawLabels {
		if isProtectedLabel(k) || isPreviewProvenanceLabel(k) {
			continue
		}
		if v == "" {
			delete(userLabels, k)
			continue
		}
		if k == "severity" && !isValidSeverity(v) {
			return &ValidationError{
				Message: fmt.Sprintf("invalid severity %q: must be one of critical|warning|info|none", v),
			}
		}
		userLabels[k] = v
	}
	return nil
}

func enforceUserDefinedUpdateWritable(plan *RuleChangePlan) error {
	if plan.Writable {
		return nil
	}
	switch {
	case plan.ManagedBy != nil && *plan.ManagedBy == ManagedByGitOps:
		return notAllowedGitOpsEdit()
	case plan.ManagedBy != nil && *plan.ManagedBy == ManagedByOperator:
		return notAllowedOperatorUpdate()
	default:
		return &NotAllowedError{Message: "cannot update alert rule in the target PrometheusRule"}
	}
}

func validatePreviewClassificationRequest(req UpdateRuleClassificationRequest) error {
	if req.Component != nil && !classification.ValidateComponent(*req.Component) {
		return &ValidationError{Message: fmt.Sprintf("invalid component %q", *req.Component)}
	}
	if req.Layer != nil && !classification.ValidateLayer(*req.Layer) {
		return &ValidationError{Message: fmt.Sprintf("invalid layer %q (allowed: cluster, namespace)", *req.Layer)}
	}
	if req.ComponentFrom != nil {
		v := strings.TrimSpace(*req.ComponentFrom)
		if v == "" {
			return &ValidationError{Message: "openshift_io_alert_rule_component_from must not be empty or whitespace-only; set to null to remove"}
		}
		if !classification.ValidatePromLabelName(v) {
			return &ValidationError{Message: fmt.Sprintf("invalid openshift_io_alert_rule_component_from %q (must be a valid Prometheus label name)", *req.ComponentFrom)}
		}
	}
	if req.LayerFrom != nil {
		v := strings.TrimSpace(*req.LayerFrom)
		if v == "" {
			return &ValidationError{Message: "openshift_io_alert_rule_layer_from must not be empty or whitespace-only; set to null to remove"}
		}
		if !classification.ValidatePromLabelName(v) {
			return &ValidationError{Message: fmt.Sprintf("invalid openshift_io_alert_rule_layer_from %q (must be a valid Prometheus label name)", *req.LayerFrom)}
		}
	}
	return nil
}

func (c *client) planUserDefinedLabelUpdate(
	ctx context.Context,
	alertRuleID string,
	relabeled monitoringv1.Rule,
	rawLabels map[string]string,
) (*RuleChangePlan, error) {
	namespace := relabeled.Labels[k8s.PrometheusRuleLabelNamespace]
	name := relabeled.Labels[k8s.PrometheusRuleLabelName]

	managedBy := managedByFromRelabeledRule(relabeled)
	writable := true
	switch managedBy {
	case ManagedByGitOps, ManagedByOperator:
		writable = false
	}

	pr, prFound, err := c.k8sClient.PrometheusRules().Get(ctx, namespace, name)
	if err != nil {
		return nil, err
	}
	if !prFound {
		return nil, &NotFoundError{Resource: "PrometheusRule", Id: alertRuleID}
	}

	if managedBy == "" {
		if mb := managedByFromObject(pr); mb != "" {
			managedBy = mb
			writable = false
		}
	}

	if c.isPlatformManagedPrometheusRule(types.NamespacedName{Namespace: namespace, Name: name}) {
		return nil, &NotAllowedError{Message: "cannot update alert rule in a platform-managed PrometheusRule"}
	}

	sourceRule, err := getOriginalPlatformRuleFromPR(pr, namespace, name, alertRuleID)
	if err != nil {
		return nil, err
	}

	userLabels := copyStringMap(sourceRule.Labels)
	if err := applyUserDefinedLabelMap(userLabels, rawLabels); err != nil {
		return nil, err
	}

	groupIdx, ruleIdx, ok := findPrometheusRuleIndices(pr, alertRuleID)
	if !ok {
		return nil, &NotFoundError{
			Resource:       "AlertRule",
			Id:             alertRuleID,
			AdditionalInfo: fmt.Sprintf("in PrometheusRule %s/%s", namespace, name),
		}
	}

	desiredRule := ruleWithLabels(*sourceRule, userLabels)
	desiredPR := buildDesiredPrometheusRuleWithRule(pr, groupIdx, ruleIdx, desiredRule)
	desiredObject, err := prometheusRuleDesiredObject(desiredPR)
	if err != nil {
		return nil, err
	}

	return buildRuleChangePlan(
		writable,
		managedBy,
		[]ResourceChangePlan{{
			Resource:      prometheusRuleRef(namespace, name),
			Changes:       diffSemanticRuleChanges(*sourceRule, desiredRule),
			DesiredObject: desiredObject,
		}},
		desiredRule,
	), nil
}

func (c *client) planPlatformUpdate(
	ctx context.Context,
	alertRuleID string,
	relabeled monitoringv1.Rule,
	classLabels map[string]string,
	userLabels map[string]string,
) (*RuleChangePlan, error) {
	filteredUser, err := filterAndValidatePlatformLabelChanges(userLabels)
	if err != nil {
		return nil, err
	}

	namespace := relabeled.Labels[k8s.PrometheusRuleLabelNamespace]
	name := relabeled.Labels[k8s.PrometheusRuleLabelName]

	pr, prFound, err := c.k8sClient.PrometheusRules().Get(ctx, namespace, name)
	if err != nil {
		return nil, err
	}
	var prMeta *monitoringv1.PrometheusRule
	if prFound {
		prMeta = pr
	}

	originalRule, err := getOriginalPlatformRuleFromPR(prMeta, namespace, name, alertRuleID)
	if err != nil {
		return nil, err
	}

	arName := relabeled.Labels[managementlabels.AlertingRuleLabelName]
	if arName == "" {
		arName = defaultAlertingRuleName
	}
	ar, arFound, arErr := c.getAlertingRule(ctx, arName)
	if arErr != nil {
		return nil, arErr
	}

	route := resolvePlatformLabelRoute(ar, arFound)
	existingArc, arcFound, err := c.loadARCForRule(ctx, relabeled, alertRuleID)
	if err != nil {
		return nil, err
	}
	allowance := evaluatePlatformPreviewAllowance(
		relabeled, prMeta, ar, arFound, existingArc, arcFound, route, classLabels, filteredUser,
	)

	var resources []ResourceChangePlan

	arcLabels := copyStringMap(classLabels)
	if route == platformLabelRouteAlertRelabelConfig && len(filteredUser) > 0 {
		arcLabels = mergeLabelMaps(arcLabels, filteredUser)
	}
	if len(arcLabels) > 0 {
		arcPlan, err := c.planARCResourceChange(
			ctx,
			alertRuleID,
			relabeled,
			*originalRule,
			arcLabels,
		)
		if err != nil {
			return nil, err
		}
		if arcPlan != nil {
			resources = append(resources, *arcPlan)
		}
	}

	if route == platformLabelRouteAlertingRule && len(filteredUser) > 0 {
		arPlan, err := c.planAlertingRuleResourceChange(
			ar,
			originalRule.Alert,
			alertRuleID,
			filteredUser,
		)
		if err != nil {
			return nil, err
		}
		if arPlan != nil {
			resources = append(resources, *arPlan)
		}
	}

	original := copyStringMap(originalRule.Labels)
	existingOverrides, existingDrops := collectExistingFromARC(arcFound, existingArc)
	effective := computeEffectiveLabels(original, existingOverrides, existingDrops)

	desiredEffective := effective
	if len(classLabels) > 0 {
		desiredEffective = buildDesiredLabels(desiredEffective, classLabels)
	}
	if len(filteredUser) > 0 {
		desiredEffective = buildDesiredLabels(desiredEffective, filteredUser)
	}
	desiredRule := ruleWithLabels(*originalRule, desiredEffective)

	return buildRuleChangePlan(allowance.Writable, allowance.ManagedBy, resources, desiredRule), nil
}

func (c *client) loadARCForRule(
	ctx context.Context,
	relabeled monitoringv1.Rule,
	alertRuleID string,
) (*osmv1.AlertRelabelConfig, bool, error) {
	arcNamespace, err := c.arcNamespaceForRule(types.NamespacedName{
		Namespace: relabeled.Labels[k8s.PrometheusRuleLabelNamespace],
		Name:      relabeled.Labels[k8s.PrometheusRuleLabelName],
	})
	if err != nil {
		return nil, false, err
	}
	prName := relabeled.Labels[k8s.PrometheusRuleLabelName]
	arcName := k8s.GetAlertRelabelConfigName(prName, alertRuleID)
	return c.k8sClient.AlertRelabelConfigs().Get(ctx, arcNamespace, arcName)
}

func (c *client) planARCResourceChange(
	ctx context.Context,
	alertRuleID string,
	relabeled monitoringv1.Rule,
	originalRule monitoringv1.Rule,
	filteredLabels map[string]string,
) (*ResourceChangePlan, error) {
	arcNamespace, err := c.arcNamespaceForRule(types.NamespacedName{
		Namespace: relabeled.Labels[k8s.PrometheusRuleLabelNamespace],
		Name:      relabeled.Labels[k8s.PrometheusRuleLabelName],
	})
	if err != nil {
		return nil, err
	}

	prName := relabeled.Labels[k8s.PrometheusRuleLabelName]
	arcName := k8s.GetAlertRelabelConfigName(prName, alertRuleID)

	existingArc, arcFound, err := c.k8sClient.AlertRelabelConfigs().Get(ctx, arcNamespace, arcName)
	if err != nil {
		return nil, fmt.Errorf("failed to get AlertRelabelConfig %s/%s: %w", arcNamespace, arcName, err)
	}

	original := copyStringMap(originalRule.Labels)
	existingOverrides, existingDrops := collectExistingFromARC(arcFound, existingArc)
	beforeEffective := computeEffectiveLabels(original, existingOverrides, existingDrops)

	mutation := computeARCLabelMutation(originalRule, alertRuleID, filteredLabels, existingArc, arcFound)
	if mutation.noOp {
		return nil, nil
	}

	afterEffective := beforeEffective
	if !mutation.deleteARC {
		afterEffective = buildDesiredLabels(beforeEffective, filteredLabels)
	}

	desiredARC := buildDesiredAlertRelabelConfigObject(
		arcNamespace, arcName, prName, originalRule.Alert, alertRuleID,
		existingArc, arcFound, mutation,
	)
	desiredObject, err := alertRelabelConfigDesiredObject(desiredARC)
	if err != nil {
		return nil, err
	}

	changes := diffEffectiveLabelChanges(beforeEffective, afterEffective)
	if mutation.deleteARC {
		changes = append(changes, RuleChange{
			Field:     "resource",
			Operation: RuleChangeOpRemove,
		})
	}

	return &ResourceChangePlan{
		Resource:      alertRelabelConfigRef(arcNamespace, arcName),
		Changes:       changes,
		DesiredObject: desiredObject,
	}, nil
}

func (c *client) planAlertingRuleResourceChange(
	ar *osmv1.AlertingRule,
	originalAlertName string,
	alertRuleID string,
	filteredLabels map[string]string,
) (*ResourceChangePlan, error) {
	target, found := findAlertByNameInAlertingRule(ar, originalAlertName)
	if !found || target == nil {
		return nil, &NotFoundError{
			Resource:       "AlertRule",
			Id:             alertRuleID,
			AdditionalInfo: fmt.Sprintf("alert %q not found in AlertingRule %s", originalAlertName, ar.Name),
		}
	}

	desired := copyStringMap(target.Labels)
	for k, v := range filteredLabels {
		if v == "" {
			delete(desired, k)
		} else {
			desired[k] = v
		}
	}

	beforeRule := osmRuleToMonitoringV1(*target)
	afterRule := beforeRule
	afterRule.Labels = copyStringMap(desired)

	desiredAR, err := buildDesiredAlertingRuleWithUpdatedLabels(ar, originalAlertName, desired)
	if err != nil {
		return nil, err
	}
	desiredObject, err := alertingRuleDesiredObject(desiredAR)
	if err != nil {
		return nil, err
	}

	changes := diffSemanticRuleChanges(beforeRule, afterRule)
	if len(changes) == 0 {
		return nil, nil
	}

	return &ResourceChangePlan{
		Resource:      alertingRuleRef(ar.Namespace, ar.Name),
		Changes:       changes,
		DesiredObject: desiredObject,
	}, nil
}

func (c *client) planDropRestoreChange(ctx context.Context, alertRuleID string, enabled bool) (*RuleChangePlan, error) {
	relabeled, found := c.k8sClient.RelabeledRules().Get(ctx, alertRuleID)
	if !found || relabeled.Labels == nil {
		return nil, &NotFoundError{Resource: "AlertRule", Id: alertRuleID}
	}

	namespace := relabeled.Labels[k8s.PrometheusRuleLabelNamespace]
	name := relabeled.Labels[k8s.PrometheusRuleLabelName]
	nn := types.NamespacedName{Namespace: namespace, Name: name}

	if !c.isPlatformManagedPrometheusRule(nn) {
		return nil, &NotAllowedError{Message: "drop/restore is only supported for platform alert rules"}
	}

	arcNamespace, err := c.arcNamespaceForRule(nn)
	if err != nil {
		return nil, err
	}

	pr, prFound, prErr := c.k8sClient.PrometheusRules().Get(ctx, namespace, name)
	if prErr != nil {
		return nil, fmt.Errorf("failed to get PrometheusRule %s/%s: %w", namespace, name, prErr)
	}
	if !prFound {
		return nil, &NotFoundError{Resource: "PrometheusRule", Id: alertRuleID}
	}

	originalRule, err := getOriginalPlatformRuleFromPR(pr, namespace, name, alertRuleID)
	if err != nil {
		return nil, err
	}

	arName := relabeled.Labels[managementlabels.AlertingRuleLabelName]
	if arName == "" {
		arName = defaultAlertingRuleName
	}
	var ar *osmv1.AlertingRule
	if fetched, arFound, arErr := c.getAlertingRule(ctx, arName); arErr != nil {
		return nil, arErr
	} else if arFound {
		ar = fetched
	}

	arcName := k8s.GetAlertRelabelConfigName(name, alertRuleID)
	existingArc, arcExists, err := c.k8sClient.AlertRelabelConfigs().Get(ctx, arcNamespace, arcName)
	if err != nil {
		return nil, fmt.Errorf("failed to get AlertRelabelConfig %s/%s: %w", arcNamespace, arcName, err)
	}

	managedBy := managedByFromRelabeledRule(relabeled)
	writable := true
	if err := validateDropRestorePreconditions(relabeled, pr, ar, relabelConfigIfFound(arcExists, existingArc)); err != nil {
		allowance := allowanceFromPreconditionError(err)
		writable = allowance.Writable
		managedBy = allowance.ManagedBy
	}

	prName := name
	var mutation arcMutationResult
	currentEnabled := true
	if arcExists && existingArc != nil {
		currentEnabled = len(getExistingRuleDrops(existingArc, alertRuleID)) == 0
	}
	if enabled {
		mutation = computeARCRestoreMutation(alertRuleID, existingArc)
	} else {
		mutation = computeARCDropMutation(*originalRule, alertRuleID, existingArc, arcExists)
	}

	desiredARC := buildDesiredAlertRelabelConfigObject(
		arcNamespace, arcName, prName, originalRule.Alert, alertRuleID,
		existingArc, arcExists, mutation,
	)
	desiredObject, err := alertRelabelConfigDesiredObject(desiredARC)
	if err != nil {
		return nil, err
	}

	return buildDropRestoreRuleChangePlan(
		writable,
		managedBy,
		alertRelabelConfigRef(arcNamespace, arcName),
		*originalRule,
		currentEnabled,
		enabled,
		desiredObject,
	), nil
}
