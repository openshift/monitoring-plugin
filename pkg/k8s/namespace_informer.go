package k8s

import (
	"context"
	"sync"

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

type namespaceInformer struct {
	informer cache.SharedIndexInformer

	// monitoringNamespaces stores namespaces with openshift.io/cluster-monitoring=true
	monitoringNamespaces map[string]bool
	mu                   sync.RWMutex
}

func newNamespaceInformer(ctx context.Context, clientset kubernetes.Interface) (NamespaceInformerInterface, error) {
	informer := cache.NewSharedIndexInformer(
		namespaceListWatch(clientset.CoreV1()),
		&corev1.Namespace{},
		0,
		cache.Indexers{},
	)

	ni := &namespaceInformer{
		informer:             informer,
		monitoringNamespaces: make(map[string]bool),
	}

	_, err := ni.informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			ns, ok := obj.(*corev1.Namespace)
			if !ok {
				return
			}
			ni.updateMonitoringNamespace(ns)
		},
		UpdateFunc: func(oldObj interface{}, newObj interface{}) {
			ns, ok := newObj.(*corev1.Namespace)
			if !ok {
				return
			}
			ni.updateMonitoringNamespace(ns)
		},
		DeleteFunc: func(obj interface{}) {
			namespaceName, err := cache.DeletionHandlingMetaNamespaceKeyFunc(obj)
			if err != nil {
				return
			}
			ni.removeMonitoringNamespace(namespaceName)
		},
	})

	go ni.informer.Run(ctx.Done())

	cache.WaitForNamedCacheSync("Namespace informer", ctx.Done(),
		ni.informer.HasSynced,
	)

	return ni, err
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

func (ni *namespaceInformer) IsClusterMonitoringNamespace(name string) bool {
	ni.mu.RLock()
	defer ni.mu.RUnlock()
	return ni.monitoringNamespaces[name]
}

func (ni *namespaceInformer) updateMonitoringNamespace(ns *corev1.Namespace) {
	ni.mu.Lock()
	defer ni.mu.Unlock()

	if ns.Labels != nil && ns.Labels[ClusterMonitoringLabel] == "true" {
		ni.monitoringNamespaces[ns.Name] = true
	} else {
		delete(ni.monitoringNamespaces, ns.Name)
	}
}

func (ni *namespaceInformer) removeMonitoringNamespace(name string) {
	ni.mu.Lock()
	defer ni.mu.Unlock()
	delete(ni.monitoringNamespaces, name)
}
