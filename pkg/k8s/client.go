package k8s

import (
	"context"
	"fmt"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"

	osmv1client "github.com/openshift/client-go/monitoring/clientset/versioned"
	monitoringv1client "github.com/prometheus-operator/prometheus-operator/pkg/client/versioned"
	"github.com/sirupsen/logrus"
)

var log = logrus.WithField("module", "k8s")

var _ Client = (*client)(nil)

type client struct {
	clientset             *kubernetes.Clientset
	monitoringv1clientset *monitoringv1client.Clientset
	osmv1clientset        *osmv1client.Clientset
	config                *rest.Config

	prometheusRuleManager *prometheusRuleManager
	namespaceManager      *namespaceManager
}

func NewClient(ctx context.Context, config *rest.Config) (Client, error) {
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create clientset: %w", err)
	}

	monitoringv1clientset, err := monitoringv1client.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create monitoringv1 clientset: %w", err)
	}

	osmv1clientset, err := osmv1client.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create osmv1 clientset: %w", err)
	}

	c := &client{
		clientset:             clientset,
		monitoringv1clientset: monitoringv1clientset,
		osmv1clientset:        osmv1clientset,
		config:                config,
	}

	c.prometheusRuleManager, err = newPrometheusRuleManager(ctx, monitoringv1clientset)
	if err != nil {
		return nil, fmt.Errorf("failed to create PrometheusRule manager: %w", err)
	}

	c.namespaceManager, err = newNamespaceManager(ctx, clientset)
	if err != nil {
		return nil, fmt.Errorf("failed to create namespace manager: %w", err)
	}

	return c, nil
}

func (c *client) TestConnection(_ context.Context) error {
	_, err := c.clientset.Discovery().ServerVersion()
	if err != nil {
		return fmt.Errorf("failed to connect to cluster: %w", err)
	}
	return nil
}

func (c *client) PrometheusRules() PrometheusRuleInterface {
	return c.prometheusRuleManager
}

func (c *client) Namespace() NamespaceInterface {
	return c.namespaceManager
}
