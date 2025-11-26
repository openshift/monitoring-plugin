package k8s

import (
	"context"
	"fmt"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	monitoringv1client "github.com/prometheus-operator/prometheus-operator/pkg/client/versioned"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

type prometheusRuleManager struct {
	clientset *monitoringv1client.Clientset
}

func newPrometheusRuleManager(clientset *monitoringv1client.Clientset) PrometheusRuleInterface {
	return &prometheusRuleManager{
		clientset: clientset,
	}
}

func (prm *prometheusRuleManager) List(ctx context.Context, namespace string) ([]monitoringv1.PrometheusRule, error) {
	prs, err := prm.clientset.MonitoringV1().PrometheusRules(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	return prs.Items, nil
}

func (prm *prometheusRuleManager) Get(ctx context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error) {
	pr, err := prm.clientset.MonitoringV1().PrometheusRules(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return nil, false, nil
		}

		return nil, false, fmt.Errorf("failed to get PrometheusRule %s/%s: %w", namespace, name, err)
	}

	return pr, true, nil
}

func (prm *prometheusRuleManager) Update(ctx context.Context, pr monitoringv1.PrometheusRule) error {
	_, err := prm.clientset.MonitoringV1().PrometheusRules(pr.Namespace).Update(ctx, &pr, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("failed to update PrometheusRule %s/%s: %w", pr.Namespace, pr.Name, err)
	}

	return nil
}

func (prm *prometheusRuleManager) Delete(ctx context.Context, namespace string, name string) error {
	err := prm.clientset.MonitoringV1().PrometheusRules(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		return fmt.Errorf("failed to delete PrometheusRule %s: %w", name, err)
	}

	return nil
}

func (prm *prometheusRuleManager) AddRule(ctx context.Context, namespacedName types.NamespacedName, groupName string, rule monitoringv1.Rule) error {
	pr, err := prm.getOrCreatePrometheusRule(ctx, namespacedName)
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

	_, err = prm.clientset.MonitoringV1().PrometheusRules(namespacedName.Namespace).Update(ctx, pr, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("failed to update PrometheusRule %s/%s: %w", namespacedName.Namespace, namespacedName.Name, err)
	}

	return nil
}

func (prm *prometheusRuleManager) getOrCreatePrometheusRule(ctx context.Context, namespacedName types.NamespacedName) (*monitoringv1.PrometheusRule, error) {
	pr, err := prm.clientset.MonitoringV1().PrometheusRules(namespacedName.Namespace).Get(ctx, namespacedName.Name, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return prm.createPrometheusRule(ctx, namespacedName)
		}

		return nil, fmt.Errorf("failed to get PrometheusRule %s/%s: %w", namespacedName.Namespace, namespacedName.Name, err)
	}

	return pr, nil
}

func (prm *prometheusRuleManager) createPrometheusRule(ctx context.Context, namespacedName types.NamespacedName) (*monitoringv1.PrometheusRule, error) {
	pr := &monitoringv1.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:      namespacedName.Name,
			Namespace: namespacedName.Namespace,
		},
		Spec: monitoringv1.PrometheusRuleSpec{
			Groups: []monitoringv1.RuleGroup{},
		},
	}

	pr, err := prm.clientset.MonitoringV1().PrometheusRules(namespacedName.Namespace).Create(ctx, pr, metav1.CreateOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to create PrometheusRule %s/%s: %w", namespacedName.Namespace, namespacedName.Name, err)
	}

	return pr, nil
}
