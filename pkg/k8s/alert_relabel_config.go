package k8s

import (
	"context"
	"fmt"

	osmv1 "github.com/openshift/api/monitoring/v1"
	osmv1client "github.com/openshift/client-go/monitoring/clientset/versioned"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type alertRelabelConfigManager struct {
	clientset *osmv1client.Clientset
}

func newAlertRelabelConfigManager(clientset *osmv1client.Clientset) AlertRelabelConfigInterface {
	return &alertRelabelConfigManager{
		clientset: clientset,
	}
}

func (arcm *alertRelabelConfigManager) List(ctx context.Context, namespace string) ([]osmv1.AlertRelabelConfig, error) {
	arcs, err := arcm.clientset.MonitoringV1().AlertRelabelConfigs(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	return arcs.Items, nil
}

func (arcm *alertRelabelConfigManager) Get(ctx context.Context, namespace string, name string) (*osmv1.AlertRelabelConfig, bool, error) {
	arc, err := arcm.clientset.MonitoringV1().AlertRelabelConfigs(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return nil, false, nil
		}

		return nil, false, fmt.Errorf("failed to get AlertRelabelConfig %s/%s: %w", namespace, name, err)
	}

	return arc, true, nil
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
