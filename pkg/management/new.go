package management

import (
	"context"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

// New creates a new management client
func New(ctx context.Context, k8sClient k8s.Client) Client {
	return &client{
		k8sClient: k8sClient,
	}
}
