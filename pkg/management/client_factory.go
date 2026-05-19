package management

import (
	"context"
	"os"
	"strings"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

// New creates a new management client.
func New(ctx context.Context, k8sClient k8s.Client) Client {
	return &client{
		k8sClient:              k8sClient,
		enableUserWorkloadARCs: strings.EqualFold(strings.TrimSpace(os.Getenv("ENABLE_USER_WORKLOAD_ARCS")), "true"),
	}
}
