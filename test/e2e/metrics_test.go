//go:build e2e

package e2e

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
	"time"

	routev1 "github.com/openshift/api/route/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

const metricsRouteName = "monitoring-plugin-metrics-e2e"

var (
	metricsRouteMu  sync.Mutex
	metricsRouteURL string
	// cleanupMetricsRoute deletes the passthrough route once it exists and is
	// a no-op before that. TestMain calls it after all tests have run.
	cleanupMetricsRoute = func() {}
)

// metricsURL returns the base URL of a passthrough route to the plugin
// service. PLUGIN_URL usually points at a reencrypt route, which terminates
// TLS at the router and therefore never forwards the scrape client
// certificate, so /metrics would always answer 401 through it. A passthrough
// route forwards the TLS session end to end, letting the plugin authenticate
// the scrape certificate itself. Route initialization is bounded by ctx, so
// a canceled caller stops waiting for route admission.
func metricsURL(ctx context.Context, f *framework.Framework) (string, error) {
	metricsRouteMu.Lock()
	defer metricsRouteMu.Unlock()
	if metricsRouteURL != "" {
		return metricsRouteURL, nil
	}
	url, err := createMetricsRoute(ctx, f)
	if err != nil {
		return "", err
	}
	metricsRouteURL = url
	return url, nil
}

func createMetricsRoute(ctx context.Context, f *framework.Framework) (string, error) {
	routes := f.Routev1clientset.RouteV1().Routes(k8s.ClusterMonitoringNamespace)
	cleanupMetricsRoute = func() {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		if err := routes.Delete(ctx, metricsRouteName, metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
			fmt.Fprintf(os.Stderr, "delete metrics passthrough route: %v\n", err)
		}
	}

	weight := int32(100)
	route := &routev1.Route{
		ObjectMeta: metav1.ObjectMeta{
			Name:      metricsRouteName,
			Namespace: k8s.ClusterMonitoringNamespace,
			// The plugin runs two replicas and only the leader serves
			// /metrics. Default source-IP affinity can pin every scrape to
			// the follower, so spread requests across both replicas.
			Annotations: map[string]string{
				"haproxy.router.openshift.io/balance": "roundrobin",
			},
		},
		Spec: routev1.RouteSpec{
			To: routev1.RouteTargetReference{
				Kind:   "Service",
				Name:   "monitoring-plugin",
				Weight: &weight,
			},
			Port: &routev1.RoutePort{TargetPort: intstr.FromString("https")},
			TLS:  &routev1.TLSConfig{Termination: routev1.TLSTerminationPassthrough},
		},
	}

	// The setup timeout derives from the caller's context, so cancellation
	// stops route creation as well as admission polling below.
	routeCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	if _, err := routes.Create(routeCtx, route, metav1.CreateOptions{}); err != nil {
		if !apierrors.IsAlreadyExists(err) {
			return "", fmt.Errorf("create metrics passthrough route: %w", err)
		}
		// A route left behind by an earlier run may lack the roundrobin
		// annotation; update the existing object, whose resourceVersion is
		// required, so the balance setting is guaranteed.
		existing, err := routes.Get(routeCtx, metricsRouteName, metav1.GetOptions{})
		if err != nil {
			return "", fmt.Errorf("read existing metrics passthrough route: %w", err)
		}
		if existing.Annotations["haproxy.router.openshift.io/balance"] != "roundrobin" {
			if existing.Annotations == nil {
				existing.Annotations = make(map[string]string)
			}
			existing.Annotations["haproxy.router.openshift.io/balance"] = "roundrobin"
			if _, err := routes.Update(routeCtx, existing, metav1.UpdateOptions{}); err != nil {
				return "", fmt.Errorf("update metrics passthrough route: %w", err)
			}
		}
	}

	var host string
	if err := framework.PollWithContext(ctx, 5*time.Second, 2*time.Minute, func(ctx context.Context) error {
		current, err := routes.Get(ctx, metricsRouteName, metav1.GetOptions{})
		if err != nil {
			return err
		}
		for _, ingress := range current.Status.Ingress {
			if ingress.Host == "" {
				continue
			}
			for _, condition := range ingress.Conditions {
				if condition.Type == routev1.RouteAdmitted && condition.Status == corev1.ConditionTrue {
					host = ingress.Host
					return nil
				}
			}
		}
		return fmt.Errorf("route not admitted yet")
	}); err != nil {
		return "", fmt.Errorf("wait for metrics passthrough route: %w", err)
	}
	return "https://" + host, nil
}

func fetchMetrics(ctx context.Context, f *framework.Framework) (metricsBody string, err error) {
	baseURL, err := metricsURL(ctx, f)
	if err != nil {
		return "", err
	}
	// The scrape deadline starts after the route is ready: route admission
	// can take minutes, which would otherwise consume the whole budget.
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	return scrapeMetrics(ctx, f, baseURL)
}

// scrapeMetrics fetches /metrics from baseURL with the Prometheus scrape
// certificate, which the endpoint requires for authentication.
func scrapeMetrics(ctx context.Context, f *framework.Framework, baseURL string) (metricsBody string, err error) {
	secret, err := f.Clientset.CoreV1().Secrets(k8s.ClusterMonitoringNamespace).Get(ctx, "metrics-client-certs", metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("read Prometheus metrics client certificate: %w", err)
	}
	certificate, err := tls.X509KeyPair(secret.Data["tls.crt"], secret.Data["tls.key"])
	if err != nil {
		return "", fmt.Errorf("parse Prometheus metrics client certificate: %w", err)
	}
	transport := f.HTTPClient().Transport.(*http.Transport).Clone()
	transport.TLSClientConfig = transport.TLSClientConfig.Clone()
	transport.TLSClientConfig.Certificates = []tls.Certificate{certificate}
	defer transport.CloseIdleConnections()
	client := &http.Client{Transport: transport, Timeout: 30 * time.Second}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/metrics", nil)
	if err != nil {
		return "", err
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer func() {
		if closeErr := resp.Body.Close(); closeErr != nil && err == nil {
			err = fmt.Errorf("closing response body: %w", closeErr)
		}
	}()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}
