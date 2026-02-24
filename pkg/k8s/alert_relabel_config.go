package k8s

import (
	"context"
	"fmt"

	osmv1 "github.com/openshift/api/monitoring/v1"
	osmv1client "github.com/openshift/client-go/monitoring/clientset/versioned"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/client-go/tools/cache"
)

type alertRelabelConfigManager struct {
	clientset   *osmv1client.Clientset
	arcInformer cache.SharedIndexInformer
}

func newAlertRelabelConfigManager(ctx context.Context, clientset *osmv1client.Clientset) (*alertRelabelConfigManager, error) {
	arcInformer := cache.NewSharedIndexInformer(
		alertRelabelConfigListWatchForAllNamespaces(clientset),
		&osmv1.AlertRelabelConfig{},
		0,
		cache.Indexers{},
	)

	arcm := &alertRelabelConfigManager{
		clientset:   clientset,
		arcInformer: arcInformer,
	}

	go arcm.arcInformer.Run(ctx.Done())

	cache.WaitForNamedCacheSync("AlertRelabelConfig informer", ctx.Done(),
		arcm.arcInformer.HasSynced,
	)

	return arcm, nil
}

func alertRelabelConfigListWatchForAllNamespaces(clientset *osmv1client.Clientset) *cache.ListWatch {
	return cache.NewListWatchFromClient(clientset.MonitoringV1().RESTClient(), "alertrelabelconfigs", "", fields.Everything())
}

func (arcm *alertRelabelConfigManager) List(ctx context.Context, namespace string) ([]osmv1.AlertRelabelConfig, error) {
	arcs := arcm.arcInformer.GetStore().List()

	alertRelabelConfigs := make([]osmv1.AlertRelabelConfig, 0, len(arcs))
	for _, item := range arcs {
		arc, ok := item.(*osmv1.AlertRelabelConfig)
		if !ok {
			continue
		}
		alertRelabelConfigs = append(alertRelabelConfigs, *arc)
	}

	return alertRelabelConfigs, nil
}

func (arcm *alertRelabelConfigManager) Get(ctx context.Context, namespace string, name string) (*osmv1.AlertRelabelConfig, bool, error) {
	arc, err := arcm.clientset.MonitoringV1().AlertRelabelConfigs(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return nil, false, nil
		}

		return nil, false, err
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
