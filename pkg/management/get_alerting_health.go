package management

import (
	"context"
	"time"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

const alertingHealthTimeout = 10 * time.Second

// GetAlertingHealth retrieves alerting health details.
func (c *client) GetAlertingHealth(ctx context.Context) (k8s.AlertingHealth, error) {
	if _, hasDeadline := ctx.Deadline(); !hasDeadline {
		timeoutCtx, cancel := context.WithTimeout(ctx, alertingHealthTimeout)
		defer cancel()
		ctx = timeoutCtx
	}

	return c.k8sClient.AlertingHealth(ctx)
}
