package k8s

import (
	"context"

	"k8s.io/client-go/rest"
)

// NewClient creates a new Kubernetes client with the given options
func NewClient(ctx context.Context, config *rest.Config) (Client, error) {
	return newClient(ctx, config)
}
