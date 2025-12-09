package k8s

import (
	"context"
	"fmt"

	osmv1 "github.com/openshift/api/monitoring/v1"
	osmv1client "github.com/openshift/client-go/monitoring/clientset/versioned"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type alertRelabelConfigManager struct {
	clientset *osmv1client.Clientset
	informer  AlertRelabelConfigInformerInterface
}

func newAlertRelabelConfigManager(clientset *osmv1client.Clientset, informer AlertRelabelConfigInformerInterface) AlertRelabelConfigInterface {
	return &alertRelabelConfigManager{
		clientset: clientset,
		informer:  informer,
	}
}

func (arcm *alertRelabelConfigManager) List(ctx context.Context, namespace string) ([]osmv1.AlertRelabelConfig, error) {
	return arcm.informer.List(ctx, namespace)
}

func (arcm *alertRelabelConfigManager) Get(ctx context.Context, namespace string, name string) (*osmv1.AlertRelabelConfig, bool, error) {
	return arcm.informer.Get(ctx, namespace, name)
}

func (arcm *alertRelabelConfigManager) Create(ctx context.Context, arc osmv1.AlertRelabelConfig) (*osmv1.AlertRelabelConfig, error) {
	created, err := arcm.clientset.MonitoringV1().AlertRelabelConfigs(arc.Namespace).Create(ctx, &arc, metav1.CreateOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to create AlertRelabelConfig %s/%s: %w", arc.Namespace, arc.Name, err)
	}

	return created, nil
}

func (arcm *alertRelabelConfigManager) Update(ctx context.Context, arc osmv1.AlertRelabelConfig) error {
	_, err := arcm.clientset.MonitoringV1().AlertRelabelConfigs(arc.Namespace).Update(ctx, &arc, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("failed to update AlertRelabelConfig %s/%s: %w", arc.Namespace, arc.Name, err)
	}

	return nil
}

func (arcm *alertRelabelConfigManager) Delete(ctx context.Context, namespace string, name string) error {
	err := arcm.clientset.MonitoringV1().AlertRelabelConfigs(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		return fmt.Errorf("failed to delete AlertRelabelConfig %s: %w", name, err)
	}

	return nil
}
