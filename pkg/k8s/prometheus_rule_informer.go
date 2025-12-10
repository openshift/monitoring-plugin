package k8s

import (
	"context"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	monitoringv1client "github.com/prometheus-operator/prometheus-operator/pkg/client/versioned"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/client-go/tools/cache"
)

type prometheusRuleInformer struct {
	informer cache.SharedIndexInformer
}

func newPrometheusRuleInformer(clientset *monitoringv1client.Clientset) PrometheusRuleInformerInterface {
	informer := cache.NewSharedIndexInformer(
		prometheusRuleListWatchForAllNamespaces(clientset),
		&monitoringv1.PrometheusRule{},
		0,
		cache.Indexers{},
	)

	return &prometheusRuleInformer{
		informer: informer,
	}
}

func prometheusRuleListWatchForAllNamespaces(clientset *monitoringv1client.Clientset) *cache.ListWatch {
	return cache.NewListWatchFromClient(clientset.MonitoringV1().RESTClient(), "prometheusrules", "", fields.Everything())
}

func (pri *prometheusRuleInformer) Run(ctx context.Context, callbacks PrometheusRuleInformerCallback) error {
	_, err := pri.informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			pr, ok := obj.(*monitoringv1.PrometheusRule)
			if !ok {
				return
			}
			callbacks.OnAdd(pr)
		},
		UpdateFunc: func(oldObj interface{}, newObj interface{}) {
			pr, ok := newObj.(*monitoringv1.PrometheusRule)
			if !ok {
				return
			}
			callbacks.OnUpdate(pr)
		},
		DeleteFunc: func(obj interface{}) {
			k, err := cache.DeletionHandlingObjectToName(obj)
			if err != nil {
				return
			}

			callbacks.OnDelete(k)
		},
	})

	go pri.informer.Run(ctx.Done())

	cache.WaitForNamedCacheSync("PrometheusRule informer", ctx.Done(),
		pri.informer.HasSynced,
	)

	return err
}

func (pri *prometheusRuleInformer) List(ctx context.Context, namespace string) ([]monitoringv1.PrometheusRule, error) {
	prs := pri.informer.GetStore().List()

	prometheusRules := make([]monitoringv1.PrometheusRule, 0, len(prs))
	for _, pr := range prs {
		prometheusRules = append(prometheusRules, *pr.(*monitoringv1.PrometheusRule))
	}

	return prometheusRules, nil
}

func (pri *prometheusRuleInformer) Get(ctx context.Context, namespace string, name string) (*monitoringv1.PrometheusRule, bool, error) {
	pr, exists, err := pri.informer.GetStore().GetByKey(namespace + "/" + name)
	if err != nil {
		return nil, exists, err
	}

	return pr.(*monitoringv1.PrometheusRule), exists, nil
}
