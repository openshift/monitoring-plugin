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
		if !classification.ValidatePromLabelName(k) {
			return &ValidationError{
				Message: fmt.Sprintf("invalid label name %q: must be a valid Prometheus label name", k),
			}
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

	pr, prFound, err := c.k8sClient.PrometheusRules().Get(ctx, namespace, name)
	if err != nil {
		return nil, err
	}
	if !prFound {
		return nil, &NotFoundError{Resource: "PrometheusRule", Id: alertRuleID}
	}

	// The live PrometheusRule is authoritative for management state: the
	// relabeled rule's managed-by label is a relabel-time snapshot and can
	// be stale when the resource gained or lost external management since.
	managedBy := managedByFromObject(pr)
	writable := managedBy == nil

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
	changes := diffSemanticRuleChanges(*sourceRule, desiredRule)
	if len(changes) > 0 {
		computedID, err := c.validateUpdatedUserDefinedRuleID(
			ctx, alertRuleID, desiredRule, pr, groupIdx, ruleIdx,
		)
		if err != nil {
			return nil, err
		}
		if desiredRule.Labels == nil {
			desiredRule.Labels = map[string]string{}
		}
		desiredRule.Labels[k8s.AlertRuleLabelId] = computedID
	}
	desiredPR := buildDesiredPrometheusRuleWithUpdatedRule(pr, groupIdx, ruleIdx, desiredRule)
	desiredObject, err := prometheusRuleToObject(desiredPR)
	if err != nil {
		return nil, err
	}

	return buildRuleChangePlan(
		writable,
		managedBy,
		[]ResourceChangePlan{{
			Resource:      prometheusRuleRef(namespace, name),
			Changes:       changes,
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
	loadedARC, err := c.loadARCForRule(ctx, relabeled, alertRuleID)
	if err != nil {
		return nil, err
	}
	allowance := evaluatePlatformPreviewAllowance(
		relabeled, prMeta, ar, arFound, loadedARC.arc, loadedARC.found, route, classLabels, filteredUser,
	)

	var resources []ResourceChangePlan

	arcLabels := copyStringMap(classLabels)
	if route == platformLabelRouteAlertRelabelConfig && len(filteredUser) > 0 {
		arcLabels = mergeLabelMaps(arcLabels, filteredUser)
	}
	var arcOutcome *arcLabelOutcome
	if len(arcLabels) > 0 {
		arcPlan, outcome, err := c.planARCResourceChange(
			alertRuleID,
			*originalRule,
			arcLabels,
			loadedARC,
		)
		if err != nil {
			return nil, err
		}
		if arcPlan != nil {
			resources = append(resources, *arcPlan)
			arcOutcome = outcome
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
	existingOverrides, existingDrops := collectExistingFromARC(loadedARC.found, loadedARC.arc)
	effective := computeEffectiveLabels(original, existingOverrides, existingDrops)

	desiredEffective := effective
	switch {
	case route == platformLabelRouteAlertingRule && len(filteredUser) > 0:
		// Direct AlertingRule mutations land first; surviving ARC overrides
		// (existing ones plus new classification labels) still apply on top
		// at relabel time, so compute the effective labels in that order.
		mutated := buildDesiredLabels(original, filteredUser)
		overrides, drops := existingOverrides, existingDrops
		if arcOutcome != nil {
			overrides, drops = arcOutcome.overrides, arcOutcome.drops
		}
		desiredEffective = computeEffectiveLabels(mutated, overrides, drops)
	case arcOutcome != nil:
		// The executed ARC defines the resulting labels; derive the preview
		// from the configs it will persist so cleared classification fields
		// the ARC retains (labels set by the source rule) are not reported
		// as removed.
		desiredEffective = computeEffectiveLabels(original, arcOutcome.overrides, arcOutcome.drops)
	}
	desiredRule := ruleWithLabels(*originalRule, desiredEffective)

	return buildRuleChangePlan(allowance.Writable, allowance.ManagedBy, resources, desiredRule), nil
}

type loadedAlertRelabelConfig struct {
	arc       *osmv1.AlertRelabelConfig
	found     bool
	namespace string
	name      string
	prName    string
}

func (c *client) loadARCForRule(
	ctx context.Context,
	relabeled monitoringv1.Rule,
	alertRuleID string,
) (loadedAlertRelabelConfig, error) {
	arcNamespace, err := c.arcNamespaceForRule(types.NamespacedName{
		Namespace: relabeled.Labels[k8s.PrometheusRuleLabelNamespace],
		Name:      relabeled.Labels[k8s.PrometheusRuleLabelName],
	})
	if err != nil {
		return loadedAlertRelabelConfig{}, err
	}
	prName := relabeled.Labels[k8s.PrometheusRuleLabelName]
	arcName := k8s.GetAlertRelabelConfigName(prName, alertRuleID)
	arc, found, err := c.k8sClient.AlertRelabelConfigs().Get(ctx, arcNamespace, arcName)
	if err != nil {
		return loadedAlertRelabelConfig{}, fmt.Errorf("failed to get AlertRelabelConfig %s/%s: %w", arcNamespace, arcName, err)
	}
	return loadedAlertRelabelConfig{
		arc:       arc,
		found:     found,
		namespace: arcNamespace,
		name:      arcName,
		prName:    prName,
	}, nil
}

// arcLabelOutcome describes the label overrides and drops the executed ARC
// will persist for the rule, so previews can derive the resulting effective
// labels from the same configs execution writes.
type arcLabelOutcome struct {
	overrides map[string]string
	drops     map[string]struct{}
}

func (c *client) planARCResourceChange(
	alertRuleID string,
	originalRule monitoringv1.Rule,
	filteredLabels map[string]string,
	loaded loadedAlertRelabelConfig,
) (*ResourceChangePlan, *arcLabelOutcome, error) {
	original := copyStringMap(originalRule.Labels)
	existingOverrides, existingDrops := collectExistingFromARC(loaded.found, loaded.arc)
	beforeEffective := computeEffectiveLabels(original, existingOverrides, existingDrops)

	mutation := computeARCLabelMutation(originalRule, alertRuleID, filteredLabels, loaded.arc, loaded.found)
	if mutation.noOp {
		return nil, nil, nil
	}

	desiredARC := buildDesiredAlertRelabelConfigObject(
		loaded.namespace, loaded.name, loaded.prName, originalRule.Alert, alertRuleID,
		loaded.arc, loaded.found, mutation,
	)
	desiredObject, err := alertRelabelConfigToObject(desiredARC)
	if err != nil {
		return nil, nil, err
	}

	var afterEffective map[string]string
	var outcome *arcLabelOutcome
	if mutation.deleteARC {
		// Removing the ARC reverts every override and drop for this rule, so
		// the effective labels return to the source rule's labels.
		afterEffective = original
		outcome = &arcLabelOutcome{overrides: map[string]string{}, drops: map[string]struct{}{}}
	} else {
		// Derive the effective labels from the configs the executed ARC will
		// persist so the preview matches execution exactly: clearing a label
		// that the source rule sets retains the source value, because the
		// ARC only carries Replace configs for labels that differ from the
		// source.
		overrides, drops := collectExistingFromARC(true, desiredARC)
		// The alert-rule-id stamp is provenance, not a user-visible label.
		delete(overrides, k8s.AlertRuleLabelId)
		afterEffective = computeEffectiveLabels(original, overrides, drops)
		outcome = &arcLabelOutcome{overrides: overrides, drops: drops}
	}

	changes := diffEffectiveLabelChanges(beforeEffective, afterEffective)
	if mutation.deleteARC {
		changes = append(changes, RuleChange{
			Field:     "resource",
			Operation: RuleChangeOpRemove,
		})
	}

	return &ResourceChangePlan{
		Resource:      alertRelabelConfigRef(loaded.namespace, loaded.name),
		Changes:       changes,
		DesiredObject: desiredObject,
	}, outcome, nil
}

func (c *client) planAlertingRuleResourceChange(
	ar *osmv1.AlertingRule,
	originalAlertName string,
	alertRuleID string,
	filteredLabels map[string]string,
) (*ResourceChangePlan, error) {
	groupIdx, alertIdx, found := findAlertIndicesInAlertingRule(ar, originalAlertName)
	if !found {
		return nil, &NotFoundError{
			Resource:       "AlertRule",
			Id:             alertRuleID,
			AdditionalInfo: fmt.Sprintf("alert %q not found in AlertingRule %s", originalAlertName, ar.Name),
		}
	}
	target := &ar.Spec.Groups[groupIdx].Rules[alertIdx]

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

	desiredAR := buildDesiredAlertingRuleWithUpdatedLabels(ar, groupIdx, alertIdx, desired)
	desiredObject, err := alertingRuleToObject(desiredAR)
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
		if enabled {
			return c.planDroppedRuleRestore(ctx, alertRuleID)
		}
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

	// Drop/restore is permitted for operator-managed rules (that is the
	// suppression mechanism); only GitOps blocks it, so start writable and
	// let validateDropRestorePreconditions report blocked changes.
	writable := true
	var managedBy *ManagementSource
	if err := validateDropRestorePreconditions(relabeled, pr, ar, relabelConfigIfFound(arcExists, existingArc)); err != nil {
		allowance := allowanceFromPreconditionError(err)
		writable = allowance.Writable
		managedBy = allowance.ManagedBy
	}

	return buildDropRestorePreviewPlan(
		writable, managedBy, arcNamespace, arcName, name, alertRuleID,
		*originalRule, existingArc, arcExists, enabled,
	)
}

func (c *client) planDroppedRuleRestore(ctx context.Context, alertRuleID string) (*RuleChangePlan, error) {
	existingARC, arcName, err := c.findARCByAlertRuleID(ctx, alertRuleID)
	if err != nil {
		return nil, err
	}
	if existingARC == nil {
		return nil, &NotFoundError{Resource: "AlertRule", Id: alertRuleID}
	}

	prName := existingARC.Labels[managementlabels.ARCLabelPrometheusRuleNameKey]
	if prName == "" {
		return nil, &NotFoundError{
			Resource:       "PrometheusRule",
			Id:             alertRuleID,
			AdditionalInfo: "AlertRelabelConfig does not identify its PrometheusRule",
		}
	}
	sourcePR, originalRule, err := c.resolveDroppedRuleSource(ctx, prName, alertRuleID)
	if err != nil {
		return nil, err
	}

	// Drop/restore is permitted for operator-managed rules (that is the
	// suppression mechanism); only GitOps blocks it, so start writable and
	// let validateDropRestorePreconditions report blocked changes.
	writable := true
	var managedBy *ManagementSource
	if err := validateDropRestorePreconditions(monitoringv1.Rule{}, sourcePR, nil, existingARC); err != nil {
		allowance := allowanceFromPreconditionError(err)
		writable = allowance.Writable
		managedBy = allowance.ManagedBy
	}

	return buildDropRestorePreviewPlan(
		writable, managedBy, k8s.ClusterMonitoringNamespace, arcName, prName, alertRuleID,
		*originalRule, existingARC, true, true,
	)
}

// resolveDroppedRuleSourcePR locates the platform-managed PrometheusRule that
// owns a dropped alert rule, using the AlertRelabelConfig's PrometheusRule
// name label.
func (c *client) resolveDroppedRuleSourcePR(
	ctx context.Context,
	prName, alertRuleID string,
) (*monitoringv1.PrometheusRule, error) {
	prs, err := c.k8sClient.PrometheusRules().List()
	if err != nil {
		return nil, fmt.Errorf("failed to list PrometheusRules: %w", err)
	}

	var candidates []types.NamespacedName
	for i := range prs {
		pr := &prs[i]
		if pr.Name != prName {
			continue
		}
		nn := types.NamespacedName{Namespace: pr.Namespace, Name: pr.Name}
		if !c.isPlatformManagedPrometheusRule(nn) {
			continue
		}
		if _, _, found := findPrometheusRuleIndices(pr, alertRuleID); found {
			candidates = append(candidates, nn)
		}
	}

	if len(candidates) == 0 {
		return nil, &NotFoundError{Resource: "PrometheusRule", Id: alertRuleID}
	}
	if len(candidates) > 1 {
		return nil, &ConflictError{Message: "multiple platform PrometheusRules match the dropped alert rule"}
	}

	nn := candidates[0]
	pr, found, err := c.k8sClient.PrometheusRules().Get(ctx, nn.Namespace, nn.Name)
	if err != nil {
		return nil, fmt.Errorf("failed to get PrometheusRule %s/%s: %w", nn.Namespace, nn.Name, err)
	}
	if !found {
		return nil, &NotFoundError{Resource: "PrometheusRule", Id: alertRuleID}
	}
	return pr, nil
}

func (c *client) resolveDroppedRuleSource(
	ctx context.Context,
	prName, alertRuleID string,
) (*monitoringv1.PrometheusRule, *monitoringv1.Rule, error) {
	pr, err := c.resolveDroppedRuleSourcePR(ctx, prName, alertRuleID)
	if err != nil {
		return nil, nil, err
	}
	rule, err := getOriginalPlatformRuleFromPR(pr, pr.Namespace, pr.Name, alertRuleID)
	if err != nil {
		return nil, nil, err
	}
	return pr, rule, nil
}

func buildDropRestorePreviewPlan(
	writable bool,
	managedBy *ManagementSource,
	arcNamespace, arcName, prName, alertRuleID string,
	originalRule monitoringv1.Rule,
	existingARC *osmv1.AlertRelabelConfig,
	arcExists, enabled bool,
) (*RuleChangePlan, error) {
	currentEnabled := true
	if arcExists && existingARC != nil {
		currentEnabled = len(getExistingRuleDrops(existingARC, alertRuleID)) == 0
	}

	var mutation arcMutationResult
	if enabled {
		mutation = computeARCRestoreMutation(alertRuleID, existingARC)
	} else {
		mutation = computeARCDropMutation(originalRule, alertRuleID, existingARC, arcExists)
	}

	desiredARC := buildDesiredAlertRelabelConfigObject(
		arcNamespace, arcName, prName, originalRule.Alert, alertRuleID,
		existingARC, arcExists, mutation,
	)
	desiredObject, err := alertRelabelConfigToObject(desiredARC)
	if err != nil {
		return nil, err
	}

	// The desired ARC keeps this rule's label overrides whether the rule is
	// being restored or dropped, so the previewed rule reflects them in both
	// cases and agrees with the desired ARC.
	retainedOverrides, retainedDrops := collectExistingFromARC(desiredARC != nil, desiredARC)
	delete(retainedOverrides, k8s.AlertRuleLabelId)
	desiredRule := ruleWithLabels(
		originalRule,
		computeEffectiveLabels(copyStringMap(originalRule.Labels), retainedOverrides, retainedDrops),
	)

	return buildDropRestoreRuleChangePlan(
		writable,
		managedBy,
		alertRelabelConfigRef(arcNamespace, arcName),
		desiredRule,
		currentEnabled,
		enabled,
		desiredObject,
	), nil
}
