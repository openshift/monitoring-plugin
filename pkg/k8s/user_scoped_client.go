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

// buildUserScopedConfig creates a rest.Config that authenticates exclusively
// with the given bearer token. It uses AnonymousClientConfig to strip all
// existing auth (certs, basic auth, auth/exec providers, impersonation) while
// preserving the server connection settings (host, TLS CA, proxy).
func buildUserScopedConfig(baseConfig *rest.Config, userToken string) *rest.Config {
	cfg := rest.AnonymousClientConfig(baseConfig)
	cfg.BearerToken = userToken
	return cfg
}

// newUserScopedClientsets creates clientsets that carry the supplied bearer
// token so that Kubernetes RBAC is enforced for the requesting user on all
// mutating API calls.
func newUserScopedClientsets(baseConfig *rest.Config, userToken string) (*userScopedClientsets, error) {
	cfg := buildUserScopedConfig(baseConfig, userToken)

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
