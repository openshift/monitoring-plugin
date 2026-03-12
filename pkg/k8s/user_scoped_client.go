package k8s

import (
	osmv1client "github.com/openshift/client-go/monitoring/clientset/versioned"
	monitoringv1client "github.com/prometheus-operator/prometheus-operator/pkg/client/versioned"
	"k8s.io/client-go/rest"
)

// userScopedClientsets holds short-lived clientsets that authenticate as the
// requesting user rather than the plugin's service account.
type userScopedClientsets struct {
	monitoringV1 *monitoringv1client.Clientset
	osmV1        *osmv1client.Clientset
}

// newUserScopedClientsets creates clientsets that carry the supplied bearer
// token so that Kubernetes RBAC is enforced for the requesting user on all
// mutating API calls.
func newUserScopedClientsets(baseConfig *rest.Config, userToken string) (*userScopedClientsets, error) {
	cfg := rest.CopyConfig(baseConfig)
	// Override any SA token loaded from the file system with the user's token.
	cfg.BearerToken = userToken
	cfg.BearerTokenFile = ""

	monClient, err := monitoringv1client.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}

	osmClient, err := osmv1client.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}

	return &userScopedClientsets{
		monitoringV1: monClient,
		osmV1:        osmClient,
	}, nil
}
