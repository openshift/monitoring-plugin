//go:build e2e

package framework

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	osmv1client "github.com/openshift/client-go/monitoring/clientset/versioned"
	monitoringv1client "github.com/prometheus-operator/prometheus-operator/pkg/client/versioned"
	authv1 "k8s.io/api/authentication/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

var f *Framework

type Framework struct {
	Clientset             *kubernetes.Clientset
	Monitoringv1clientset *monitoringv1client.Clientset
	Osmv1clientset        *osmv1client.Clientset

	PluginURL   string
	BearerToken string
	httpClient  *http.Client
}

type CleanupFunc func() error

// New creates a Framework backed by a real Kubernetes cluster. It reads
// KUBECONFIG and PLUGIN_URL from the environment and returns a singleton
// so that expensive client setup happens only once per test binary.
func New() (*Framework, error) {
	if f != nil {
		return f, nil
	}

	kubeConfigPath := os.Getenv("KUBECONFIG")
	if kubeConfigPath == "" {
		return nil, fmt.Errorf("KUBECONFIG environment variable is not set")
	}

	pluginURL := os.Getenv("PLUGIN_URL")
	if pluginURL == "" {
		return nil, fmt.Errorf("PLUGIN_URL environment variable is not set")
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

	bearerToken, err := resolveToken(clientset, config)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve bearer token: %w", err)
	}

	f = &Framework{
		Clientset:             clientset,
		Monitoringv1clientset: monitoringv1clientset,
		Osmv1clientset:        osmv1clientset,
		PluginURL:             pluginURL,
		BearerToken:           bearerToken,
	}

	return f, nil
}

// HTTPClient returns a shared *http.Client configured for the plugin URL.
// For HTTPS endpoints it skips certificate verification (self-signed certs
// used by in-cluster deployments behind port-forward). The client is reused
// across calls to keep connections alive and avoid exhausting port-forward tunnels.
func (f *Framework) HTTPClient() *http.Client {
	if f.httpClient != nil {
		return f.httpClient
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	if strings.HasPrefix(f.PluginURL, "https://") {
		transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	}
	f.httpClient = &http.Client{
		Timeout:   30 * time.Second,
		Transport: transport,
	}
	return f.httpClient
}

// CreatePlatformNamespace creates a namespace which is monitored by the platform monitoring stack.
func (f *Framework) CreatePlatformNamespace(ctx context.Context, name string) (string, CleanupFunc, error) {
	return f.createNamespace(ctx, name, true)
}

// CreateUserNamespace creates a namespace which is monitored by the user-defined monitoring stack.
func (f *Framework) CreateUserNamespace(ctx context.Context, name string) (string, CleanupFunc, error) {
	return f.createNamespace(ctx, name, false)
}

func (f *Framework) createNamespace(ctx context.Context, name string, isClusterMonitoringNamespace bool) (string, CleanupFunc, error) {
	testNamespace := fmt.Sprintf("%s-%d", name, time.Now().Unix())
	namespace := &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name:   testNamespace,
			Labels: map[string]string{},
		},
	}

	if isClusterMonitoringNamespace {
		namespace.Labels[k8s.ClusterMonitoringLabel] = "true"
	}

	_, err := f.Clientset.CoreV1().Namespaces().Create(ctx, namespace, metav1.CreateOptions{})
	if err != nil {
		return "", nil, fmt.Errorf("failed to create test namespace: %w", err)
	}

	return testNamespace, func() error {
		return f.Clientset.CoreV1().Namespaces().Delete(ctx, testNamespace, metav1.DeleteOptions{})
	}, nil
}

// AuthorizedRequest creates an HTTP request with the Bearer token set.
func (f *Framework) AuthorizedRequest(ctx context.Context, method, url string, body interface{ Read([]byte) (int, error) }) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, err
	}
	if f.BearerToken != "" {
		req.Header.Set("Authorization", "Bearer "+f.BearerToken)
	}
	return req, nil
}

// resolveToken returns a bearer token for authenticating HTTP requests to the
// plugin server. It tries, in order: inline BearerToken, BearerTokenFile, and
// finally creates a short-lived ServiceAccount token (for CI kubeconfigs that
// use client-certificate auth).
func resolveToken(clientset *kubernetes.Clientset, config *rest.Config) (string, error) {
	if config.BearerToken != "" {
		return config.BearerToken, nil
	}
	if config.BearerTokenFile != "" {
		data, err := os.ReadFile(config.BearerTokenFile)
		if err != nil {
			return "", fmt.Errorf("reading bearer token file: %w", err)
		}
		token := strings.TrimSpace(string(data))
		if token != "" {
			return token, nil
		}
	}
	return createServiceAccountToken(clientset)
}

// createServiceAccountToken creates a ServiceAccount with cluster-admin
// privileges and returns a short-lived bearer token for it. This covers CI
// environments where the kubeconfig authenticates via client certificates
// and no bearer token is available.
func createServiceAccountToken(clientset *kubernetes.Clientset) (string, error) {
	ctx := context.Background()
	const saName = "e2e-management-api"
	const ns = "default"

	sa := &corev1.ServiceAccount{
		ObjectMeta: metav1.ObjectMeta{Name: saName},
	}
	if _, err := clientset.CoreV1().ServiceAccounts(ns).Create(ctx, sa, metav1.CreateOptions{}); err != nil && !apierrors.IsAlreadyExists(err) {
		return "", fmt.Errorf("creating service account: %w", err)
	}

	crb := &rbacv1.ClusterRoleBinding{
		ObjectMeta: metav1.ObjectMeta{Name: saName},
		Subjects: []rbacv1.Subject{{
			Kind:      rbacv1.ServiceAccountKind,
			Name:      saName,
			Namespace: ns,
		}},
		RoleRef: rbacv1.RoleRef{
			APIGroup: rbacv1.GroupName,
			Kind:     "ClusterRole",
			Name:     "cluster-admin",
		},
	}
	if _, err := clientset.RbacV1().ClusterRoleBindings().Create(ctx, crb, metav1.CreateOptions{}); err != nil && !apierrors.IsAlreadyExists(err) {
		return "", fmt.Errorf("creating cluster role binding: %w", err)
	}

	expSeconds := int64(3600)
	treq := &authv1.TokenRequest{
		Spec: authv1.TokenRequestSpec{
			ExpirationSeconds: &expSeconds,
		},
	}
	resp, err := clientset.CoreV1().ServiceAccounts(ns).CreateToken(ctx, saName, treq, metav1.CreateOptions{})
	if err != nil {
		return "", fmt.Errorf("requesting service account token: %w", err)
	}
	return resp.Status.Token, nil
}

// ScopedUser represents a ServiceAccount with specific RBAC permissions for testing.
type ScopedUser struct {
	Token   string
	Cleanup CleanupFunc
}

// requestServiceAccountToken creates a short-lived (1 hour) bearer token for
// the named ServiceAccount via the TokenRequest API.
func (f *Framework) requestServiceAccountToken(ctx context.Context, namespace, name string) (string, error) {
	expSeconds := int64(3600)
	treq := &authv1.TokenRequest{
		Spec: authv1.TokenRequestSpec{ExpirationSeconds: &expSeconds},
	}
	tokenResp, err := f.Clientset.CoreV1().ServiceAccounts(namespace).CreateToken(ctx, name, treq, metav1.CreateOptions{})
	if err != nil {
		return "", fmt.Errorf("requesting token for %s/%s: %w", namespace, name, err)
	}
	return tokenResp.Status.Token, nil
}

// retry calls fn up to maxAttempts times with a 1-second pause between attempts.
// It returns nil on the first successful call or the last error after exhaustion.
func retry(maxAttempts int, fn func() error) error {
	var err error
	for i := range maxAttempts {
		if err = fn(); err == nil {
			return nil
		}
		if i < maxAttempts-1 {
			time.Sleep(time.Second)
		}
	}
	return err
}

// CreateScopedUser creates a ServiceAccount in the given namespace with a Role
// granting the specified verbs on the specified resources. Returns a bearer token
// and a cleanup function. The apiGroup should be e.g. "monitoring.coreos.com".
// API calls are retried to tolerate transient failures.
func (f *Framework) CreateScopedUser(ctx context.Context, name, namespace, apiGroup string, resources, verbs []string) (*ScopedUser, error) {
	rollback := func() {
		_ = f.Clientset.RbacV1().RoleBindings(namespace).Delete(ctx, name, metav1.DeleteOptions{})
		_ = f.Clientset.RbacV1().Roles(namespace).Delete(ctx, name, metav1.DeleteOptions{})
		_ = f.Clientset.CoreV1().ServiceAccounts(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	}

	sa := &corev1.ServiceAccount{
		ObjectMeta: metav1.ObjectMeta{Name: name},
	}
	err := retry(3, func() error {
		_, err := f.Clientset.CoreV1().ServiceAccounts(namespace).Create(ctx, sa, metav1.CreateOptions{})
		if apierrors.IsAlreadyExists(err) {
			return nil
		}
		return err
	})
	if err != nil {
		return nil, fmt.Errorf("creating service account %s/%s: %w", namespace, name, err)
	}

	role := &rbacv1.Role{
		ObjectMeta: metav1.ObjectMeta{Name: name},
		Rules: []rbacv1.PolicyRule{{
			APIGroups: []string{apiGroup},
			Resources: resources,
			Verbs:     verbs,
		}},
	}
	err = retry(3, func() error {
		_, err := f.Clientset.RbacV1().Roles(namespace).Create(ctx, role, metav1.CreateOptions{})
		if apierrors.IsAlreadyExists(err) {
			return nil
		}
		return err
	})
	if err != nil {
		rollback()
		return nil, fmt.Errorf("creating role %s/%s: %w", namespace, name, err)
	}

	rb := &rbacv1.RoleBinding{
		ObjectMeta: metav1.ObjectMeta{Name: name},
		Subjects: []rbacv1.Subject{{
			Kind:      rbacv1.ServiceAccountKind,
			Name:      name,
			Namespace: namespace,
		}},
		RoleRef: rbacv1.RoleRef{
			APIGroup: rbacv1.GroupName,
			Kind:     "Role",
			Name:     name,
		},
	}
	err = retry(3, func() error {
		_, err := f.Clientset.RbacV1().RoleBindings(namespace).Create(ctx, rb, metav1.CreateOptions{})
		if apierrors.IsAlreadyExists(err) {
			return nil
		}
		return err
	})
	if err != nil {
		rollback()
		return nil, fmt.Errorf("creating role binding %s/%s: %w", namespace, name, err)
	}

	token, err := f.requestServiceAccountToken(ctx, namespace, name)
	if err != nil {
		rollback()
		return nil, err
	}

	return &ScopedUser{Token: token, Cleanup: func() error { rollback(); return nil }}, nil
}

// CreateAnonymousUser creates a ServiceAccount with no RBAC permissions.
// API calls are retried to tolerate transient failures.
func (f *Framework) CreateAnonymousUser(ctx context.Context, name, namespace string) (*ScopedUser, error) {
	sa := &corev1.ServiceAccount{
		ObjectMeta: metav1.ObjectMeta{Name: name},
	}
	err := retry(3, func() error {
		_, err := f.Clientset.CoreV1().ServiceAccounts(namespace).Create(ctx, sa, metav1.CreateOptions{})
		if apierrors.IsAlreadyExists(err) {
			return nil
		}
		return err
	})
	if err != nil {
		return nil, fmt.Errorf("creating service account %s/%s: %w", namespace, name, err)
	}

	token, err := f.requestServiceAccountToken(ctx, namespace, name)
	if err != nil {
		_ = f.Clientset.CoreV1().ServiceAccounts(namespace).Delete(ctx, name, metav1.DeleteOptions{})
		return nil, err
	}

	cleanup := func() error {
		_ = f.Clientset.CoreV1().ServiceAccounts(namespace).Delete(ctx, name, metav1.DeleteOptions{})
		return nil
	}

	return &ScopedUser{Token: token, Cleanup: cleanup}, nil
}
