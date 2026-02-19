package k8s

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"gopkg.in/yaml.v2"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"
)

const (
	clusterMonitoringConfigMap = "cluster-monitoring-config"
	clusterMonitoringConfigKey = "config.yaml"
)

type clusterMonitoringConfig struct {
	EnableUserWorkload bool `yaml:"enableUserWorkload"`
}

// clusterMonitoringConfigManager watches the cluster-monitoring-config ConfigMap
// via an informer and caches the parsed enableUserWorkload value so that
// AlertingHealth never needs a live API call.
type clusterMonitoringConfigManager struct {
	informer cache.SharedIndexInformer

	mu      sync.RWMutex
	enabled bool
	err     error
}

func newClusterMonitoringConfigManager(ctx context.Context, clientset *kubernetes.Clientset) (*clusterMonitoringConfigManager, error) {
	informer := cache.NewSharedIndexInformer(
		cache.NewListWatchFromClient(
			clientset.CoreV1().RESTClient(),
			"configmaps",
			ClusterMonitoringNamespace,
			fields.OneTermEqualSelector("metadata.name", clusterMonitoringConfigMap),
		),
		&corev1.ConfigMap{},
		0,
		cache.Indexers{},
	)

	m := &clusterMonitoringConfigManager{
		informer: informer,
	}

	_, err := informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			cm, ok := obj.(*corev1.ConfigMap)
			if !ok {
				return
			}
			m.handleUpdate(cm)
		},
		UpdateFunc: func(_, newObj interface{}) {
			cm, ok := newObj.(*corev1.ConfigMap)
			if !ok {
				return
			}
			m.handleUpdate(cm)
		},
		DeleteFunc: func(_ interface{}) {
			m.mu.Lock()
			defer m.mu.Unlock()
			m.enabled = false
			m.err = nil
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to add event handler to cluster-monitoring-config informer: %w", err)
	}

	go informer.Run(ctx.Done())

	cache.WaitForNamedCacheSync("ClusterMonitoringConfig informer", ctx.Done(),
		informer.HasSynced,
	)

	return m, nil
}

func (m *clusterMonitoringConfigManager) handleUpdate(cm *corev1.ConfigMap) {
	m.mu.Lock()
	defer m.mu.Unlock()

	raw, ok := cm.Data[clusterMonitoringConfigKey]
	if !ok || strings.TrimSpace(raw) == "" {
		m.enabled = false
		m.err = nil
		return
	}

	var cfg clusterMonitoringConfig
	if err := yaml.Unmarshal([]byte(raw), &cfg); err != nil {
		m.enabled = false
		m.err = fmt.Errorf("parse cluster monitoring config.yaml: %w", err)
		return
	}

	m.enabled = cfg.EnableUserWorkload
	m.err = nil
}

func (m *clusterMonitoringConfigManager) userWorkloadEnabled() (bool, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.enabled, m.err
}

// AlertingHealth returns alerting route health and UWM enablement status.
func (c *client) AlertingHealth(ctx context.Context) (AlertingHealth, error) {
	health := c.prometheusAlerts.alertingHealth(ctx)

	enabled, err := c.clusterMonitoringConfig.userWorkloadEnabled()
	if err != nil {
		return health, fmt.Errorf("failed to determine user workload enablement: %w", err)
	}
	health.UserWorkloadEnabled = enabled

	return health, nil
}
