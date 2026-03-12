package k8s

import (
	"context"
	"fmt"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	monitoringv1client "github.com/prometheus-operator/prometheus-operator/pkg/client/versioned"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/retry"
)

type prometheusRuleManager struct {
	clientset *monitoringv1client.Clientset
	config    *rest.Config
	informer  cache.SharedIndexInformer
}

func newPrometheusRuleManager(ctx context.Context, clientset *monitoringv1client.Clientset, config *rest.Config) (*prometheusRuleManager, error) {
	informer := cache.NewSharedIndexInformer(
		prometheusRuleListWatchForAllNamespaces(clientset),
		&monitoringv1.PrometheusRule{},
		0,
		cache.Indexers{},
	)

	go informer.Run(ctx.Done())

	if !cache.WaitForNamedCacheSync("PrometheusRule informer", ctx.Done(), informer.HasSynced) {
		return nil, fmt.Errorf("failed to sync PrometheusRule informer")
	}

	return &prometheusRuleManager{
		clientset: clientset,
		config:    config,
		informer:  informer,
	}, nil
}

func prometheusRuleListWatchForAllNamespaces(clientset *monitoringv1client.Clientset) *cache.ListWatch {
	return cache.NewListWatchFromClient(clientset.MonitoringV1().RESTClient(), "prometheusrules", "", fields.Everything())
}

func (prm *prometheusRuleManager) List() ([]monitoringv1.PrometheusRule, error) {
	prs := prm.informer.GetStore().List()

	prometheusRules := make([]monitoringv1.PrometheusRule, 0, len(prs))
	for _, item := range prs {
		pr, ok := item.(*monitoringv1.PrometheusRule)
		if !ok {
			continue
		}
		prometheusRules = append(prometheusRules, *pr)
	}

	return prometheusRules, nil
}

func (prm *prometheusRuleManager) Get(ctx context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error) {
	pr, err := prm.clientset.MonitoringV1().PrometheusRules(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return nil, false, nil
		}

		return nil, false, err
	}

	return pr, true, nil
}

func (prm *prometheusRuleManager) Update(ctx context.Context, pr monitoringv1.PrometheusRule) error {
	cs, err := prm.clientsetForCtx(ctx)
	if err != nil {
		return err
	}
	_, err = cs.MonitoringV1().PrometheusRules(pr.Namespace).Update(ctx, &pr, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("failed to update PrometheusRule %s/%s: %w", pr.Namespace, pr.Name, err)
	}

	return nil
}

func (prm *prometheusRuleManager) Delete(ctx context.Context, namespace string, name string) error {
	cs, err := prm.clientsetForCtx(ctx)
	if err != nil {
		return err
	}
	err = cs.MonitoringV1().PrometheusRules(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		return fmt.Errorf("failed to delete PrometheusRule %s: %w", name, err)
	}

	return nil
}

// clientsetForCtx returns a user-scoped clientset when the context carries a
// bearer token (i.e. on API handler requests), or the SA-level clientset for
// background / informer bootstrap calls.
func (prm *prometheusRuleManager) clientsetForCtx(ctx context.Context) (*monitoringv1client.Clientset, error) {
	token := BearerTokenFromContext(ctx)
	if token == "" {
		return prm.clientset, nil
	}
	cs, err := newUserScopedClientsets(prm.config, token)
	if err != nil {
		return nil, fmt.Errorf("failed to create user-scoped clientset: %w", err)
	}
	return cs.monitoringV1, nil
}

func (prm *prometheusRuleManager) AddRule(ctx context.Context, namespacedName types.NamespacedName, groupName string, rule monitoringv1.Rule) error {
	cs, err := prm.clientsetForCtx(ctx)
	if err != nil {
		return err
	}

	// RetryOnConflict handles the concurrent update (409) case that arises when
	// multiple replicas perform a read-modify-write on the same PrometheusRule
	// at the same time.
	return retry.RetryOnConflict(retry.DefaultRetry, func() error {
		pr, err := prm.getOrCreatePrometheusRule(ctx, cs, namespacedName)
		if err != nil {
			return err
		}

		// Find or create the group
		var group *monitoringv1.RuleGroup
		for i := range pr.Spec.Groups {
			if pr.Spec.Groups[i].Name == groupName {
				group = &pr.Spec.Groups[i]
				break
			}
		}
		if group == nil {
			pr.Spec.Groups = append(pr.Spec.Groups, monitoringv1.RuleGroup{
				Name:  groupName,
				Rules: []monitoringv1.Rule{},
			})
			group = &pr.Spec.Groups[len(pr.Spec.Groups)-1]
		}

		// Add the new rule to the group
		group.Rules = append(group.Rules, rule)

		_, err = cs.MonitoringV1().PrometheusRules(namespacedName.Namespace).Update(ctx, pr, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("failed to update PrometheusRule %s/%s: %w", namespacedName.Namespace, namespacedName.Name, err)
		}

		return nil
	})
}

func (prm *prometheusRuleManager) getOrCreatePrometheusRule(ctx context.Context, cs *monitoringv1client.Clientset, namespacedName types.NamespacedName) (*monitoringv1.PrometheusRule, error) {
	pr, err := cs.MonitoringV1().PrometheusRules(namespacedName.Namespace).Get(ctx, namespacedName.Name, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return prm.createPrometheusRule(ctx, cs, namespacedName)
		}

		return nil, fmt.Errorf("failed to get PrometheusRule %s/%s: %w", namespacedName.Namespace, namespacedName.Name, err)
	}

	return pr, nil
}

func (prm *prometheusRuleManager) createPrometheusRule(ctx context.Context, cs *monitoringv1client.Clientset, namespacedName types.NamespacedName) (*monitoringv1.PrometheusRule, error) {
	pr := &monitoringv1.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:      namespacedName.Name,
			Namespace: namespacedName.Namespace,
		},
		Spec: monitoringv1.PrometheusRuleSpec{
			Groups: []monitoringv1.RuleGroup{},
		},
	}

	pr, err := cs.MonitoringV1().PrometheusRules(namespacedName.Namespace).Create(ctx, pr, metav1.CreateOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to create PrometheusRule %s/%s: %w", namespacedName.Namespace, namespacedName.Name, err)
	}

	return pr, nil
}
