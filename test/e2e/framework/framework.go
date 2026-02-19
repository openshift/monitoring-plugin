package framework

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	osmv1client "github.com/openshift/client-go/monitoring/clientset/versioned"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	monitoringv1client "github.com/prometheus-operator/prometheus-operator/pkg/client/versioned"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

var f *Framework

type Framework struct {
	Clientset             *kubernetes.Clientset
	Monitoringv1clientset *monitoringv1client.Clientset
	Osmv1clientset        *osmv1client.Clientset

	PluginURL string
}

type CleanupFunc func() error

func New() (*Framework, error) {
	if f != nil {
		return f, nil
	}

	kubeConfigPath := os.Getenv("KUBECONFIG")
	if kubeConfigPath == "" {
		return nil, fmt.Errorf("KUBECONFIG environment variable not set")
	}

	pluginURL := os.Getenv("PLUGIN_URL")
	if pluginURL == "" {
		return nil, fmt.Errorf("PLUGIN_URL environment variable not set, skipping management API e2e test")
	}

	config, err := clientcmd.BuildConfigFromFlags("", kubeConfigPath)
	if err != nil {
		return nil, fmt.Errorf("failed to build config: %w", err)
	}

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

	f = &Framework{
		Clientset:             clientset,
		Monitoringv1clientset: monitoringv1clientset,
		Osmv1clientset:        osmv1clientset,
		PluginURL:             pluginURL,
	}

	return f, nil
}

func (f *Framework) CreateNamespace(ctx context.Context, name string, isClusterMonitoringNamespace bool) (string, CleanupFunc, error) {
	testNamespace := fmt.Sprintf("%s-%d", name, time.Now().Unix())
	namespace := &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: testNamespace,
			Labels: map[string]string{
				k8s.ClusterMonitoringLabel: strconv.FormatBool(isClusterMonitoringNamespace),
			},
		},
	}

	_, err := f.Clientset.CoreV1().Namespaces().Create(ctx, namespace, metav1.CreateOptions{})
	if err != nil {
		return "", nil, fmt.Errorf("failed to create test namespace: %w", err)
	}

	return testNamespace, func() error {
		return f.Clientset.CoreV1().Namespaces().Delete(ctx, testNamespace, metav1.DeleteOptions{})
	}, nil
}
