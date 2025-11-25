package management

import (
	"context"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management/mapper"
)

// New creates a new management client
func New(ctx context.Context, k8sClient k8s.Client) Client {
	m := mapper.New(k8sClient)
	m.WatchPrometheusRules(ctx)
	m.WatchAlertRelabelConfigs(ctx)

	return NewWithCustomMapper(ctx, k8sClient, m)
}

func NewWithCustomMapper(ctx context.Context, k8sClient k8s.Client, m mapper.Client) Client {
	return &client{
		k8sClient: k8sClient,
		mapper:    m,
	}
}
