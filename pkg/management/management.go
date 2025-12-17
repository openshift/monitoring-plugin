package management

import (
	"k8s.io/apimachinery/pkg/types"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

type client struct {
	k8sClient k8s.Client
}

func (c *client) IsPlatformAlertRule(prId types.NamespacedName) bool {
	return c.k8sClient.Namespace().IsClusterMonitoringNamespace(prId.Namespace)
}
