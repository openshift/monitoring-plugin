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

type alertingRuleManager struct {
	clientset *osmv1client.Clientset
	informer  cache.SharedIndexInformer
}

func newAlertingRuleManager(ctx context.Context, clientset *osmv1client.Clientset) (*alertingRuleManager, error) {
	informer := cache.NewSharedIndexInformer(
		alertingRuleListWatchClusterMonitoringNamespace(clientset),
		&osmv1.AlertingRule{},
		0,
		cache.Indexers{},
	)

	arm := &alertingRuleManager{
		clientset: clientset,
		informer:  informer,
	}

	go arm.informer.Run(ctx.Done())

	if !cache.WaitForNamedCacheSync("AlertingRule informer", ctx.Done(), arm.informer.HasSynced) {
		return nil, errors.NewInternalError(fmt.Errorf("failed to sync AlertingRule informer"))
	}

	return arm, nil
}

func alertingRuleListWatchClusterMonitoringNamespace(clientset *osmv1client.Clientset) *cache.ListWatch {
	return cache.NewListWatchFromClient(clientset.MonitoringV1().RESTClient(), "alertingrules", ClusterMonitoringNamespace, fields.Everything())
}

func (arm *alertingRuleManager) List(ctx context.Context) ([]osmv1.AlertingRule, error) {
	items := arm.informer.GetStore().List()

	alertingRules := make([]osmv1.AlertingRule, 0, len(items))
	for _, item := range items {
		ar, ok := item.(*osmv1.AlertingRule)
		if !ok {
			continue
		}
		alertingRules = append(alertingRules, *ar)
	}

	return alertingRules, nil
}

func (arm *alertingRuleManager) Get(ctx context.Context, name string) (*osmv1.AlertingRule, bool, error) {
	ar, err := arm.clientset.MonitoringV1().AlertingRules(ClusterMonitoringNamespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return nil, false, nil
		}

		return nil, false, err
	}

	return ar, true, nil
}

func (arm *alertingRuleManager) Create(ctx context.Context, ar osmv1.AlertingRule) (*osmv1.AlertingRule, error) {
	if ar.Namespace != "" && ar.Namespace != ClusterMonitoringNamespace {
		return nil, fmt.Errorf("invalid namespace %q: AlertingRule manager only supports %q", ar.Namespace, ClusterMonitoringNamespace)
	}

	created, err := arm.clientset.MonitoringV1().AlertingRules(ClusterMonitoringNamespace).Create(ctx, &ar, metav1.CreateOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to create AlertingRule %s/%s: %w", ClusterMonitoringNamespace, ar.Name, err)
	}

	return created, nil
}

func (arm *alertingRuleManager) Update(ctx context.Context, ar osmv1.AlertingRule) error {
	if ar.Namespace != "" && ar.Namespace != ClusterMonitoringNamespace {
		return fmt.Errorf("invalid namespace %q: AlertingRule manager only supports %q", ar.Namespace, ClusterMonitoringNamespace)
	}

	_, err := arm.clientset.MonitoringV1().AlertingRules(ClusterMonitoringNamespace).Update(ctx, &ar, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("failed to update AlertingRule %s/%s: %w", ClusterMonitoringNamespace, ar.Name, err)
	}

	return nil
}

func (arm *alertingRuleManager) Delete(ctx context.Context, name string) error {
	err := arm.clientset.MonitoringV1().AlertingRules(ClusterMonitoringNamespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		return fmt.Errorf("failed to delete AlertingRule %s/%s: %w", ClusterMonitoringNamespace, name, err)
	}

	return nil
}
