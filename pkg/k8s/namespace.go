package k8s

import (
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	corev1client "k8s.io/client-go/kubernetes/typed/core/v1"
	"k8s.io/client-go/tools/cache"
)

const (
	// ClusterMonitoringLabel is the label used to identify namespaces with cluster monitoring enabled
	ClusterMonitoringLabel = "openshift.io/cluster-monitoring"
)

type namespaceManager struct {
	informer cache.SharedIndexInformer
}

func newNamespaceManager(ctx context.Context, clientset *kubernetes.Clientset) (*namespaceManager, error) {
	informer := cache.NewSharedIndexInformer(
		namespaceListWatch(clientset.CoreV1()),
		&corev1.Namespace{},
		0,
		cache.Indexers{},
	)

	nm := &namespaceManager{
		informer: informer,
	}

	go nm.informer.Run(ctx.Done())

	if !cache.WaitForNamedCacheSync("Namespace informer", ctx.Done(), nm.informer.HasSynced) {
		return nil, fmt.Errorf("failed to sync Namespace informer")
	}

	return nm, nil
}

func namespaceListWatch(client corev1client.CoreV1Interface) *cache.ListWatch {
	return cache.NewFilteredListWatchFromClient(
		client.RESTClient(),
		"namespaces",
		"",
		func(options *metav1.ListOptions) {
			options.LabelSelector = ClusterMonitoringLabel + "=true"
		},
	)
}

// IsClusterMonitoringNamespace returns true if the namespace has the
// openshift.io/cluster-monitoring=true label. The check is a simple
// existence lookup in the informer's Store, which only contains
// namespaces matching that label selector.
func (nm *namespaceManager) IsClusterMonitoringNamespace(name string) bool {
	_, exists, _ := nm.informer.GetStore().GetByKey(name)
	return exists
}
