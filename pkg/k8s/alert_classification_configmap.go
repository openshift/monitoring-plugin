package k8s

import (
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// AlertRuleClassificationConfigMapManager provides the minimal ConfigMap ops
// needed by the alert-rule classification update flow.
type AlertRuleClassificationConfigMapManager struct {
	client *client
}

var _ ConfigMapInterface = (*AlertRuleClassificationConfigMapManager)(nil)

func (c *client) ConfigMaps() ConfigMapInterface {
	return &AlertRuleClassificationConfigMapManager{client: c}
}

func (m *AlertRuleClassificationConfigMapManager) Get(ctx context.Context, namespace string, name string) (*corev1.ConfigMap, bool, error) {
	cm, err := m.client.clientset.CoreV1().ConfigMaps(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil, false, nil
		}
		return nil, false, err
	}
	return cm, true, nil
}

func (m *AlertRuleClassificationConfigMapManager) Update(ctx context.Context, cm corev1.ConfigMap) error {
	_, err := m.client.clientset.CoreV1().ConfigMaps(cm.Namespace).Update(ctx, &cm, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("update configmap %s/%s: %w", cm.Namespace, cm.Name, err)
	}
	return nil
}

func (m *AlertRuleClassificationConfigMapManager) Create(ctx context.Context, cm corev1.ConfigMap) (*corev1.ConfigMap, error) {
	created, err := m.client.clientset.CoreV1().ConfigMaps(cm.Namespace).Create(ctx, &cm, metav1.CreateOptions{})
	if err != nil {
		return nil, fmt.Errorf("create configmap %s/%s: %w", cm.Namespace, cm.Name, err)
	}
	return created, nil
}
