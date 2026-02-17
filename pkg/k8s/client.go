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

	prometheusAlerts *prometheusAlerts

	prometheusRuleManager     *prometheusRuleManager
	alertRelabelConfigManager *alertRelabelConfigManager
	alertingRuleManager       *alertingRuleManager
	namespaceManager          *namespaceManager
	relabeledRulesManager     *relabeledRulesManager
}

func newClient(ctx context.Context, config *rest.Config) (Client, error) {
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

	c.prometheusAlerts = newPrometheusAlerts(clientset, config)

	c.prometheusRuleManager = newPrometheusRuleManager(ctx, monitoringv1clientset)

	c.alertRelabelConfigManager, err = newAlertRelabelConfigManager(ctx, osmv1clientset)
	if err != nil {
		return nil, fmt.Errorf("failed to create alert relabel config manager: %w", err)
	}

	c.alertingRuleManager, err = newAlertingRuleManager(ctx, osmv1clientset)
	if err != nil {
		return nil, fmt.Errorf("failed to create alerting rule manager: %w", err)
	}

	c.namespaceManager, err = newNamespaceManager(ctx, clientset)
	if err != nil {
		return nil, fmt.Errorf("failed to create namespace manager: %w", err)
	}

	c.relabeledRulesManager, err = newRelabeledRulesManager(ctx, c.namespaceManager, c.alertRelabelConfigManager, monitoringv1clientset, clientset)
	if err != nil {
		return nil, fmt.Errorf("failed to create relabeled rules config manager: %w", err)
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

func (c *client) PrometheusAlerts() PrometheusAlertsInterface {
	return c.prometheusAlerts
}

func (c *client) PrometheusRules() PrometheusRuleInterface {
	return c.prometheusRuleManager
}

func (c *client) AlertRelabelConfigs() AlertRelabelConfigInterface {
	return c.alertRelabelConfigManager
}

func (c *client) AlertingRules() AlertingRuleInterface {
	return c.alertingRuleManager
}

func (c *client) RelabeledRules() RelabeledRulesInterface {
	return c.relabeledRulesManager
}

func (c *client) Namespace() NamespaceInterface {
	return c.namespaceManager
}
