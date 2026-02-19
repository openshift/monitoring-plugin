package k8s

import (
	"context"
	"crypto/sha256"
	"fmt"
	"strings"
	"sync"
	"time"

	alertrule "github.com/openshift/monitoring-plugin/pkg/alert_rule"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	monitoringv1client "github.com/prometheus-operator/prometheus-operator/pkg/client/versioned"
	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/model/relabel"
	"gopkg.in/yaml.v2"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/workqueue"
)

const (
	resyncPeriod   = 15 * time.Minute
	queueBaseDelay = 50 * time.Millisecond
	queueMaxDelay  = 3 * time.Minute

	AlertRelabelConfigSecretName = "alert-relabel-configs"
	AlertRelabelConfigSecretKey  = "config.yaml"

	PrometheusRuleLabelNamespace = "openshift_io_prometheus_rule_namespace"
	PrometheusRuleLabelName      = "openshift_io_prometheus_rule_name"
	AlertRuleLabelId             = "openshift_io_alert_rule_id"

	AlertRuleClassificationComponentKey = "openshift_io_alert_rule_component"
	AlertRuleClassificationLayerKey     = "openshift_io_alert_rule_layer"

	AppKubernetesIoComponent                   = "app.kubernetes.io/component"
	AppKubernetesIoManagedBy                   = "app.kubernetes.io/managed-by"
	AppKubernetesIoComponentAlertManagementApi = "alert-management-api"
	AppKubernetesIoComponentMonitoringPlugin   = "monitoring-plugin"

	ArgocdArgoprojIoPrefix = "argocd.argoproj.io/"
)

type relabeledRulesManager struct {
	queue workqueue.TypedRateLimitingInterface[string]

	namespaceManager        NamespaceInterface
	alertRelabelConfigs     AlertRelabelConfigInterface
	prometheusRulesInformer cache.SharedIndexInformer
	secretInformer          cache.SharedIndexInformer
	configMapInformer       cache.SharedIndexInformer
	clientset               kubernetes.Interface

	// relabeledRules stores the relabeled rules in memory
	relabeledRules map[string]monitoringv1.Rule
	relabelConfigs []*relabel.Config
	mu             sync.RWMutex
}

func newRelabeledRulesManager(ctx context.Context, namespaceManager NamespaceInterface, alertRelabelConfigs AlertRelabelConfigInterface, monitoringv1clientset *monitoringv1client.Clientset, clientset *kubernetes.Clientset) (*relabeledRulesManager, error) {
	prometheusRulesInformer := cache.NewSharedIndexInformer(
		prometheusRuleListWatchForAllNamespaces(monitoringv1clientset),
		&monitoringv1.PrometheusRule{},
		resyncPeriod,
		cache.Indexers{},
	)

	secretInformer := cache.NewSharedIndexInformer(
		alertRelabelConfigSecretListWatch(clientset, ClusterMonitoringNamespace),
		&corev1.Secret{},
		resyncPeriod,
		cache.Indexers{},
	)

	queue := workqueue.NewTypedRateLimitingQueueWithConfig(
		workqueue.NewTypedItemExponentialFailureRateLimiter[string](queueBaseDelay, queueMaxDelay),
		workqueue.TypedRateLimitingQueueConfig[string]{Name: "relabeled-rules"},
	)

	rrm := &relabeledRulesManager{
		queue:                   queue,
		namespaceManager:        namespaceManager,
		alertRelabelConfigs:     alertRelabelConfigs,
		prometheusRulesInformer: prometheusRulesInformer,
		secretInformer:          secretInformer,
	}

	_, err := rrm.prometheusRulesInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			promRule, ok := obj.(*monitoringv1.PrometheusRule)
			if !ok {
				return
			}
			log.Debugf("prometheus rule added: %s/%s", promRule.Namespace, promRule.Name)
			rrm.queue.Add("prometheus-rule-sync")
		},
		UpdateFunc: func(oldObj interface{}, newObj interface{}) {
			promRule, ok := newObj.(*monitoringv1.PrometheusRule)
			if !ok {
				return
			}
			log.Debugf("prometheus rule updated: %s/%s", promRule.Namespace, promRule.Name)
			rrm.queue.Add("prometheus-rule-sync")
		},
		DeleteFunc: func(obj interface{}) {
			if tombstone, ok := obj.(cache.DeletedFinalStateUnknown); ok {
				obj = tombstone.Obj
			}

			promRule, ok := obj.(*monitoringv1.PrometheusRule)
			if !ok {
				return
			}
			log.Debugf("prometheus rule deleted: %s/%s", promRule.Namespace, promRule.Name)
			rrm.queue.Add("prometheus-rule-sync")
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to add event handler to prometheus rules informer: %w", err)
	}

	_, err = rrm.secretInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			rrm.queue.Add("secret-sync")
		},
		UpdateFunc: func(oldObj interface{}, newObj interface{}) {
			rrm.queue.Add("secret-sync")
		},
		DeleteFunc: func(obj interface{}) {
			rrm.queue.Add("secret-sync")
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to add event handler to secret informer: %w", err)
	}

	go rrm.prometheusRulesInformer.Run(ctx.Done())
	go rrm.secretInformer.Run(ctx.Done())

	cache.WaitForNamedCacheSync("RelabeledRulesConfig informer", ctx.Done(),
		rrm.prometheusRulesInformer.HasSynced,
		rrm.secretInformer.HasSynced,
	)

	go rrm.worker(ctx)
	rrm.queue.Add("initial-sync")

	return rrm, nil
}

func alertRelabelConfigSecretListWatch(clientset *kubernetes.Clientset, namespace string) *cache.ListWatch {
	return cache.NewListWatchFromClient(
		clientset.CoreV1().RESTClient(),
		"secrets",
		namespace,
		fields.OneTermEqualSelector("metadata.name", AlertRelabelConfigSecretName),
	)
}

func (rrm *relabeledRulesManager) worker(ctx context.Context) {
	for rrm.processNextWorkItem(ctx) {
	}
}

func (rrm *relabeledRulesManager) processNextWorkItem(ctx context.Context) bool {
	key, quit := rrm.queue.Get()
	if quit {
		return false
	}

	defer rrm.queue.Done(key)

	if err := rrm.sync(ctx); err != nil {
		log.Errorf("error syncing relabeled rules: %v", err)
		rrm.queue.AddRateLimited(key)
		return true
	}

	rrm.queue.Forget(key)

	return true
}

func (rrm *relabeledRulesManager) sync(ctx context.Context) error {
	relabelConfigs, err := rrm.loadRelabelConfigs()
	if err != nil {
		return fmt.Errorf("failed to load relabel configs: %w", err)
	}

	rrm.mu.Lock()
	rrm.relabelConfigs = relabelConfigs
	rrm.mu.Unlock()

	alerts := rrm.collectAlerts(ctx, relabelConfigs)

	rrm.mu.Lock()
	rrm.relabeledRules = alerts
	rrm.mu.Unlock()

	log.Infof("Synced %d relabeled rules in memory", len(alerts))
	return nil
}

func (rrm *relabeledRulesManager) loadRelabelConfigs() ([]*relabel.Config, error) {
	storeKey := fmt.Sprintf("%s/%s", ClusterMonitoringNamespace, AlertRelabelConfigSecretName)
	obj, exists, err := rrm.secretInformer.GetStore().GetByKey(storeKey)
	if err != nil {
		return nil, fmt.Errorf("failed to get secret from store: %w", err)
	}
	if !exists {
		log.Infof("Alert relabel config secret %q not found", storeKey)
		return nil, nil
	}

	secret, ok := obj.(*corev1.Secret)
	if !ok {
		return nil, fmt.Errorf("unexpected object type in secret store: %T", obj)
	}

	configData, ok := secret.Data[AlertRelabelConfigSecretKey]
	if !ok {
		return nil, fmt.Errorf("no config data found in secret %q", AlertRelabelConfigSecretName)
	}

	var raw []*relabel.Config
	if err := yaml.Unmarshal(configData, &raw); err != nil {
		return nil, fmt.Errorf("failed to unmarshal relabel configs: %w", err)
	}

	configs := make([]*relabel.Config, 0, len(raw))
	for i, config := range raw {
		if config == nil {
			log.Warnf("skipping nil relabel config entry at index %d", i)
			continue
		}
		if config.NameValidationScheme == model.UnsetValidation {
			config.NameValidationScheme = model.UTF8Validation
		}
		if err := config.Validate(model.UTF8Validation); err != nil {
			return nil, fmt.Errorf("invalid relabel config at index %d: %w", i, err)
		}
		configs = append(configs, config)
	}

	log.Infof("Loaded %d relabel configs from secret %s", len(configs), storeKey)
	return configs, nil
}

func (rrm *relabeledRulesManager) collectAlerts(ctx context.Context, relabelConfigs []*relabel.Config) map[string]monitoringv1.Rule {
	alerts := make(map[string]monitoringv1.Rule)
	seenIDs := make(map[string]struct{})

	for _, obj := range rrm.prometheusRulesInformer.GetStore().List() {
		promRule, ok := obj.(*monitoringv1.PrometheusRule)
		if !ok {
			continue
		}

		// Skip deleted rules
		if promRule.DeletionTimestamp != nil {
			continue
		}

		for _, group := range promRule.Spec.Groups {
			for _, rule := range group.Rules {
				// Only process alerting rules (skip recording rules)
				if rule.Alert == "" {
					continue
				}

				// Compute a deterministic id from the rule spec.
				// Do not trust any user-provided value in openshift_io_alert_rule_id since
				// PrometheusRule content (including labels) can be tampered with.
				alertRuleId := alertrule.GetAlertingRuleId(&rule)
				if _, exists := seenIDs[alertRuleId]; exists {
					// A second rule that computes to the same id is ambiguous/unsupported (a "true clone").
					// Don't silently overwrite the first rule in the cache.
					log.Warnf("Duplicate alert rule id %q computed for %s/%s (alert=%q); skipping duplicate", alertRuleId, promRule.Namespace, promRule.Name, rule.Alert)
					continue
				}
				seenIDs[alertRuleId] = struct{}{}

				if rule.Labels == nil {
					rule.Labels = make(map[string]string)
				}

				rule.Labels[managementlabels.AlertNameLabel] = rule.Alert

				if rrm.namespaceManager.IsClusterMonitoringNamespace(promRule.Namespace) {
					// Relabel the alert labels
					relabeledLabels, keep := relabel.Process(labels.FromMap(rule.Labels), relabelConfigs...)
					if !keep {
						// Alert was dropped by relabeling, skip it
						log.Infof("Skipping dropped alert %s from %s/%s", rule.Alert, promRule.Namespace, promRule.Name)
						continue
					}

					// Update the alert labels
					rule.Labels = relabeledLabels.Map()
				}

				rule.Labels[AlertRuleLabelId] = alertRuleId
				rule.Labels[PrometheusRuleLabelNamespace] = promRule.Namespace
				rule.Labels[PrometheusRuleLabelName] = promRule.Name

				if arName := alertingRuleOwner(promRule); arName != "" {
					rule.Labels[managementlabels.AlertingRuleLabelName] = arName
				}

				ruleManagedBy, relabelConfigManagedBy := rrm.determineManagedBy(ctx, promRule, alertRuleId)
				if ruleManagedBy != "" {
					rule.Labels[managementlabels.RuleManagedByLabel] = ruleManagedBy
				}
				if relabelConfigManagedBy != "" {
					rule.Labels[managementlabels.RelabelConfigManagedByLabel] = relabelConfigManagedBy
				}

				alerts[alertRuleId] = rule
			}
		}
	}

	log.Debugf("Collected %d alerts", len(alerts))
	return alerts
}

// alertingRuleOwner returns the name of the AlertingRule CR that generated
// this PrometheusRule, or "" if it was not generated by one. Detection is based
// on the ownerReferences set by the alerting-rules-controller.
func alertingRuleOwner(pr *monitoringv1.PrometheusRule) string {
	for _, ref := range pr.OwnerReferences {
		if ref.Kind == "AlertingRule" && ref.Controller != nil && *ref.Controller {
			return ref.Name
		}
	}
	return ""
}

// isGitOpsManaged checks if an object is managed by GitOps (ArgoCD) based on annotations and labels
func isGitOpsManaged(obj metav1.Object) bool {
	annotations := obj.GetAnnotations()
	for key := range annotations {
		if strings.HasPrefix(key, ArgocdArgoprojIoPrefix) {
			return true
		}
	}

	labels := obj.GetLabels()
	for key := range labels {
		if strings.HasPrefix(key, ArgocdArgoprojIoPrefix) {
			return true
		}
	}

	if managedBy, exists := labels[AppKubernetesIoManagedBy]; exists {
		managedByLower := strings.ToLower(managedBy)
		if managedByLower == "openshift-gitops" || managedByLower == "argocd-cluster" || managedByLower == "argocd" || strings.Contains(managedByLower, "gitops") {
			return true
		}
	}

	return false
}

// GetAlertRelabelConfigName builds the AlertRelabelConfig name from a PrometheusRule name and alert rule ID
func GetAlertRelabelConfigName(promRuleName string, alertRuleId string) string {
	return fmt.Sprintf("arc-%s-%s", sanitizeDNSName(promRuleName), shortHash(alertRuleId, 12))
}

// sanitizeDNSName lowercases and replaces invalid chars with '-', trims extra '-'
func sanitizeDNSName(in string) string {
	if in == "" {
		return ""
	}
	s := strings.ToLower(in)
	// replace any char not [a-z0-9-] with '-'
	out := make([]rune, 0, len(s))
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			out = append(out, r)
		} else {
			out = append(out, '-')
		}
	}
	// collapse multiple '-' and trim
	res := strings.Trim(strings.ReplaceAll(string(out), "--", "-"), "-")
	if res == "" {
		return "arc"
	}
	return res
}

func shortHash(id string, n int) string {
	sum := sha256.Sum256([]byte(id))
	full := fmt.Sprintf("%x", sum[:])
	if n > len(full) {
		return full
	}
	return full[:n]
}

// determineManagedBy determines the openshift_io_rule_managed_by and openshift_io_relabel_config_managed_by label values
func (rrm *relabeledRulesManager) determineManagedBy(ctx context.Context, promRule *monitoringv1.PrometheusRule, alertRuleId string) (string, string) {
	// Determine ruleManagedBy from PrometheusRule
	var ruleManagedBy string
	if isGitOpsManaged(promRule) {
		ruleManagedBy = managementlabels.ManagedByGitOps
	} else if len(promRule.OwnerReferences) > 0 {
		ruleManagedBy = managementlabels.ManagedByOperator
	}

	// Determine relabelConfigManagedBy only for platform rules
	isPlatform := rrm.namespaceManager.IsClusterMonitoringNamespace(promRule.Namespace)
	var relabelConfigManagedBy string
	if isPlatform && rrm.alertRelabelConfigs != nil {
		arcName := GetAlertRelabelConfigName(promRule.Name, alertRuleId)
		arc, found, err := rrm.alertRelabelConfigs.Get(ctx, promRule.Namespace, arcName)
		if err == nil && found {
			if isGitOpsManaged(arc) {
				relabelConfigManagedBy = managementlabels.ManagedByGitOps
			}
		}
	}

	return ruleManagedBy, relabelConfigManagedBy
}

// DetermineManagedByForTesting creates a minimal relabeledRulesManager for testing purposes
func DetermineManagedByForTesting(ctx context.Context, alertRelabelConfigs AlertRelabelConfigInterface, namespaceManager NamespaceInterface, promRule *monitoringv1.PrometheusRule, alertRuleId string) (string, string) {
	rrm := &relabeledRulesManager{
		alertRelabelConfigs: alertRelabelConfigs,
		namespaceManager:    namespaceManager,
	}
	return rrm.determineManagedBy(ctx, promRule, alertRuleId)
}

func (rrm *relabeledRulesManager) List(ctx context.Context) []monitoringv1.Rule {
	rrm.mu.RLock()
	defer rrm.mu.RUnlock()

	var result []monitoringv1.Rule
	for _, rule := range rrm.relabeledRules {
		result = append(result, rule)
	}

	return result
}

func (rrm *relabeledRulesManager) Get(ctx context.Context, id string) (monitoringv1.Rule, bool) {
	rrm.mu.RLock()
	defer rrm.mu.RUnlock()

	rule, ok := rrm.relabeledRules[id]
	if !ok {
		return monitoringv1.Rule{}, false
	}

	return rule, true
}

func (rrm *relabeledRulesManager) Config() []*relabel.Config {
	rrm.mu.RLock()
	defer rrm.mu.RUnlock()

	return append([]*relabel.Config{}, rrm.relabelConfigs...)
}
