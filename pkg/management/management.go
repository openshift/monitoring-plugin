package management

import (
	"strings"

	"k8s.io/apimachinery/pkg/types"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management/mapper"
)

type client struct {
	k8sClient k8s.Client
	mapper    mapper.Client
}

func IsPlatformAlertRule(prId types.NamespacedName) bool {
	return strings.HasPrefix(prId.Namespace, "openshift-")
}
