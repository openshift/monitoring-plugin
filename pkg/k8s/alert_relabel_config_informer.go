package k8s

import (
	"context"

	osmv1 "github.com/openshift/api/monitoring/v1"
	osmv1client "github.com/openshift/client-go/monitoring/clientset/versioned"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/client-go/tools/cache"
)

type alertRelabelConfigInformer struct {
	informer cache.SharedIndexInformer
}

func newAlertRelabelConfigInformer(clientset *osmv1client.Clientset) AlertRelabelConfigInformerInterface {
	informer := cache.NewSharedIndexInformer(
		alertRelabelConfigListWatchForAllNamespaces(clientset),
		&osmv1.AlertRelabelConfig{},
		0,
		cache.Indexers{},
	)

	return &alertRelabelConfigInformer{
		informer: informer,
	}
}

func alertRelabelConfigListWatchForAllNamespaces(clientset *osmv1client.Clientset) *cache.ListWatch {
	return cache.NewListWatchFromClient(clientset.MonitoringV1().RESTClient(), "alertrelabelconfigs", "", fields.Everything())
}

func (arci *alertRelabelConfigInformer) Run(ctx context.Context, callbacks AlertRelabelConfigInformerCallback) error {
	_, err := arci.informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			arc, ok := obj.(*osmv1.AlertRelabelConfig)
			if !ok {
				return
			}
			callbacks.OnAdd(arc)
		},
		UpdateFunc: func(oldObj interface{}, newObj interface{}) {
			arc, ok := newObj.(*osmv1.AlertRelabelConfig)
			if !ok {
				return
			}
			callbacks.OnUpdate(arc)
		},
		DeleteFunc: func(obj interface{}) {
			k, err := cache.DeletionHandlingObjectToName(obj)
			if err != nil {
				return
			}
			callbacks.OnDelete(k)
		},
	})

	go arci.informer.Run(ctx.Done())

	cache.WaitForNamedCacheSync("AlertRelabelConfig informer", ctx.Done(),
		arci.informer.HasSynced,
	)

	return err
}

func (arci *alertRelabelConfigInformer) List(ctx context.Context, namespace string) ([]osmv1.AlertRelabelConfig, error) {
	arcs := arci.informer.GetStore().List()

	alertRelabelConfigs := make([]osmv1.AlertRelabelConfig, 0, len(arcs))
	for _, arc := range arcs {
		alertRelabelConfigs = append(alertRelabelConfigs, *arc.(*osmv1.AlertRelabelConfig))
	}

	return alertRelabelConfigs, nil
}

func (arci *alertRelabelConfigInformer) Get(ctx context.Context, namespace string, name string) (*osmv1.AlertRelabelConfig, bool, error) {
	arc, exists, err := arci.informer.GetStore().GetByKey(namespace + "/" + name)
	if err != nil {
		return nil, exists, err
	}

	return arc.(*osmv1.AlertRelabelConfig), exists, nil
}
