package k8s

import (
	"context"
	"fmt"
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

type namespaceManager struct {
	informer cache.SharedIndexInformer

	// monitoringNamespaces stores namespaces with openshift.io/cluster-monitoring=true
	monitoringNamespaces map[string]bool
	mu                   sync.RWMutex
}

func newNamespaceManager(ctx context.Context, clientset *kubernetes.Clientset) (*namespaceManager, error) {
	informer := cache.NewSharedIndexInformer(
		namespaceListWatch(clientset.CoreV1()),
		&corev1.Namespace{},
		0,
		cache.Indexers{},
	)

	nm := &namespaceManager{
		informer:             informer,
		monitoringNamespaces: make(map[string]bool),
		mu:                   sync.RWMutex{},
	}

	_, err := nm.informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			ns, ok := obj.(*corev1.Namespace)
			if !ok {
				return
			}
			nm.updateMonitoringNamespace(ns)
		},
		UpdateFunc: func(oldObj interface{}, newObj interface{}) {
			ns, ok := newObj.(*corev1.Namespace)
			if !ok {
				return
			}
			nm.updateMonitoringNamespace(ns)
		},
		DeleteFunc: func(obj interface{}) {
			namespaceName, err := cache.DeletionHandlingMetaNamespaceKeyFunc(obj)
			if err != nil {
				return
			}
			nm.removeMonitoringNamespace(namespaceName)
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to add event handler to namespace informer: %w", err)
	}

	go nm.informer.Run(ctx.Done())

	cache.WaitForNamedCacheSync("Namespace informer", ctx.Done(),
		nm.informer.HasSynced,
	)

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

func (nm *namespaceManager) updateMonitoringNamespace(ns *corev1.Namespace) {
	nm.mu.Lock()
	defer nm.mu.Unlock()

	if ns.Labels != nil && ns.Labels[ClusterMonitoringLabel] == "true" {
		nm.monitoringNamespaces[ns.Name] = true
	} else {
		delete(nm.monitoringNamespaces, ns.Name)
	}
}

func (nm *namespaceManager) removeMonitoringNamespace(name string) {
	nm.mu.Lock()
	defer nm.mu.Unlock()
	delete(nm.monitoringNamespaces, name)
}

func (nm *namespaceManager) IsClusterMonitoringNamespace(name string) bool {
	nm.mu.RLock()
	defer nm.mu.RUnlock()
	return nm.monitoringNamespaces[name]
}
