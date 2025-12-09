package management

import (
	"k8s.io/apimachinery/pkg/types"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management/mapper"
)

type client struct {
	k8sClient k8s.Client
	mapper    mapper.Client
}

func (c *client) IsPlatformAlertRule(prId types.NamespacedName) bool {
	return c.k8sClient.NamespaceInformer().IsClusterMonitoringNamespace(prId.Namespace)
}
