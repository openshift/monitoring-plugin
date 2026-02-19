package k8s

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	routev1 "github.com/openshift/api/route/v1"
	routeclient "github.com/openshift/client-go/route/clientset/versioned"
	"github.com/sirupsen/logrus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	corev1client "k8s.io/client-go/kubernetes/typed/core/v1"
	"k8s.io/client-go/rest"
)

var (
	prometheusLog = logrus.WithField("module", "k8s-prometheus")
)

const (
	namespaceCacheTTL      = 30 * time.Second
	serviceHealthTimeout   = 5 * time.Second
	serviceRequestTimeout  = 10 * time.Second
	maxTenancyProbeTargets = 3
)

type namespaceCache struct {
	mu        sync.Mutex
	expiresAt time.Time
	ttl       time.Duration
	value     []string
}

func newNamespaceCache(ttl time.Duration) *namespaceCache {
	return &namespaceCache{ttl: ttl}
}

func (c *namespaceCache) get() ([]string, bool) {
	if c == nil {
		return nil, false
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if c.expiresAt.IsZero() || time.Now().After(c.expiresAt) {
		return nil, false
	}
	return copyStringSlice(c.value), true
}

func (c *namespaceCache) set(namespaces []string) {
	if c == nil {
		return
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	c.value = copyStringSlice(namespaces)
	c.expiresAt = time.Now().Add(c.ttl)
}

type prometheusAlerts struct {
	routeClient routeclient.Interface
	coreClient  corev1client.CoreV1Interface
	config      *rest.Config
	ruleManager PrometheusRuleInterface
	nsCache     *namespaceCache

	// thanosTenancyPort caches the resolved port after the first successful
	// lookup so that we don't make a K8s API call on every request.
	thanosTenancyPortOnce sync.Once
	thanosTenancyPort     int32
}

// GetAlertsRequest holds parameters for filtering alerts
type GetAlertsRequest struct {
	// Labels filters alerts by labels
	Labels map[string]string
	// State filters alerts by state: "firing", "pending", "silenced", or "" for all states
	State string
}

type PrometheusAlert struct {
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	State       string            `json:"state"`
	ActiveAt    time.Time         `json:"activeAt"`
	Value       string            `json:"value"`

	AlertRuleId             string `json:"alertRuleId,omitempty"`
	AlertComponent          string `json:"alertComponent,omitempty"`
	AlertLayer              string `json:"alertLayer,omitempty"`
	PrometheusRuleName      string `json:"prometheusRuleName,omitempty"`
	PrometheusRuleNamespace string `json:"prometheusRuleNamespace,omitempty"`
	AlertingRuleName        string `json:"alertingRuleName,omitempty"`
}

type prometheusAlertsData struct {
	Alerts []PrometheusAlert `json:"alerts"`
}

type prometheusAlertsResponse struct {
	Status string               `json:"status"`
	Data   prometheusAlertsData `json:"data"`
}

type prometheusRulesData struct {
	Groups []PrometheusRuleGroup `json:"groups"`
}

type prometheusRulesResponse struct {
	Status string              `json:"status"`
	Data   prometheusRulesData `json:"data"`
}

type alertmanagerAlertStatus struct {
	State string `json:"state"`
}

type alertmanagerAlert struct {
	Labels       map[string]string       `json:"labels"`
	Annotations  map[string]string       `json:"annotations"`
	StartsAt     time.Time               `json:"startsAt"`
	EndsAt       time.Time               `json:"endsAt"`
	GeneratorURL string                  `json:"generatorURL"`
	Status       alertmanagerAlertStatus `json:"status"`
}

func newPrometheusAlerts(routeClient routeclient.Interface, coreClient corev1client.CoreV1Interface, config *rest.Config, ruleManager PrometheusRuleInterface) *prometheusAlerts {
	return &prometheusAlerts{
		routeClient: routeClient,
		coreClient:  coreClient,
		config:      config,
		ruleManager: ruleManager,
		nsCache:     newNamespaceCache(namespaceCacheTTL),
	}
}

func (pa *prometheusAlerts) GetAlerts(ctx context.Context, req GetAlertsRequest) ([]PrometheusAlert, error) {
	platformAlerts, err := pa.getAlertsForSource(ctx, PlatformRouteNamespace, PlatformRouteName, PlatformAlertmanagerRouteName, AlertSourcePlatform)
	if err != nil {
		return nil, err
	}

	userAlerts, err := pa.getUserWorkloadAlerts(ctx, req)
	if err != nil {
		prometheusLog.Warnf("failed to get user workload alerts: %v", err)
	}

	mergedAlerts := append(platformAlerts, userAlerts...)

	out := make([]PrometheusAlert, 0, len(mergedAlerts))
	for _, a := range mergedAlerts {
		// Filter alerts based on state if provided
		if !matchesAlertState(req.State, a.State) {
			continue
		}

		// Filter alerts based on labels if provided
		if !labelsMatch(&req, &a) {
			continue
		}

		out = append(out, a)
	}
	return out, nil
}

func matchesAlertState(requestedState string, alertState string) bool {
	if requestedState == "" {
		return true
	}
	if requestedState == "firing" {
		return alertState == "firing" || alertState == "silenced"
	}
	return alertState == requestedState
}

func (pa *prometheusAlerts) GetRules(ctx context.Context, req GetRulesRequest) ([]PrometheusRuleGroup, error) {
	platformRules, err := pa.getRulesViaProxy(ctx, PlatformRouteNamespace, PlatformRouteName, AlertSourcePlatform)
	if err != nil {
		return nil, err
	}

	userRules, err := pa.getUserWorkloadRules(ctx, req)
	if err != nil {
		prometheusLog.Warnf("failed to get user workload rules: %v", err)
	}

	return append(platformRules, userRules...), nil
}

func (pa *prometheusAlerts) alertingHealth(ctx context.Context) AlertingHealth {
	userPrometheus := pa.routeHealth(ctx, UserWorkloadRouteNamespace, UserWorkloadRouteName, PrometheusRulesPath)
	if userPrometheus.Status != RouteReachable {
		if ok := pa.thanosTenancyReachable(ctx, ThanosQuerierTenancyAlertsPath); ok {
			userPrometheus.FallbackReachable = true
		}
	}

	userAlertmanager := pa.routeHealth(ctx, UserWorkloadRouteNamespace, UserWorkloadAlertmanagerRouteName, AlertmanagerAlertsPath)
	if userAlertmanager.Status != RouteReachable {
		if ok := pa.serviceReachable(ctx, UserWorkloadRouteNamespace, UserWorkloadAlertmanagerRouteName, UserWorkloadAlertmanagerPort, AlertmanagerAlertsPath); ok {
			userAlertmanager.FallbackReachable = true
		}
	}

	platformStack := pa.stackHealth(ctx, PlatformRouteNamespace, PlatformRouteName, PlatformAlertmanagerRouteName)
	userWorkloadStack := AlertingStackHealth{
		Prometheus:   userPrometheus,
		Alertmanager: userAlertmanager,
	}

	return AlertingHealth{
		Platform:     &platformStack,
		UserWorkload: &userWorkloadStack,
	}
}

func (pa *prometheusAlerts) stackHealth(ctx context.Context, namespace string, promRouteName string, amRouteName string) AlertingStackHealth {
	return AlertingStackHealth{
		Prometheus:   pa.routeHealth(ctx, namespace, promRouteName, PrometheusRulesPath),
		Alertmanager: pa.routeHealth(ctx, namespace, amRouteName, AlertmanagerAlertsPath),
	}
}

func (pa *prometheusAlerts) routeHealth(ctx context.Context, namespace string, routeName string, path string) AlertingRouteHealth {
	health := AlertingRouteHealth{
		Name:      routeName,
		Namespace: namespace,
	}

	if pa.routeClient == nil {
		health.Error = "route client is not configured"
		return health
	}

	route, err := pa.routeClient.RouteV1().Routes(namespace).Get(ctx, routeName, metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			health.Status = RouteNotFound
			health.Error = err.Error()
			return health
		}
		health.Error = err.Error()
		return health
	}

	url := buildRouteURL(route.Spec.Host, route.Spec.Path, path)
	client, err := pa.createHTTPClient()
	if err != nil {
		health.Status = RouteUnreachable
		health.Error = err.Error()
		return health
	}

	if _, err := pa.executeRequest(ctx, client, url); err != nil {
		health.Status = RouteUnreachable
		health.Error = err.Error()
		return health
	}

	health.Status = RouteReachable
	return health
}

func (pa *prometheusAlerts) getAlertsForSource(ctx context.Context, namespace string, promRouteName string, amRouteName string, source string) ([]PrometheusAlert, error) {
	amAlerts, amErr := pa.getAlertmanagerAlerts(ctx, namespace, amRouteName, source)
	promAlerts, promErr := pa.getAlertsViaProxy(ctx, namespace, promRouteName, source)

	if amErr == nil {
		pending := filterAlertsByState(promAlerts, "pending")
		return append(amAlerts, pending...), nil
	}

	if promErr != nil {
		return nil, promErr
	}

	return promAlerts, nil
}

func (pa *prometheusAlerts) getUserWorkloadAlerts(ctx context.Context, req GetAlertsRequest) ([]PrometheusAlert, error) {
	if shouldPreferUserAlertmanager(req.State) {
		alerts, err := pa.getUserWorkloadAlertsViaAlertmanager(ctx)
		if err == nil {
			return alerts, nil
		}
		prometheusLog.Warnf("failed to get user workload alerts via alertmanager: %v", err)
	}

	namespace := namespaceFromLabels(req.Labels)
	if namespace != "" {
		alerts, err := pa.getAlertsViaThanosTenancy(ctx, namespace, AlertSourceUser)
		if err == nil {
			return alerts, nil
		}
		prometheusLog.Warnf("failed to get user workload alerts via thanos tenancy: %v", err)
	}

	userNamespaces := pa.userRuleNamespaces(ctx)
	if len(userNamespaces) > 0 {
		alerts, err := pa.getAlertsViaThanosTenancyNamespaces(ctx, userNamespaces, AlertSourceUser)
		if err == nil {
			return alerts, nil
		}
		prometheusLog.Warnf("failed to get user workload alerts via thanos tenancy namespaces: %v", err)
	}

	return pa.getAlertsForSource(ctx, UserWorkloadRouteNamespace, UserWorkloadRouteName, UserWorkloadAlertmanagerRouteName, AlertSourceUser)
}

func shouldPreferUserAlertmanager(state string) bool {
	return state == "firing" || state == "silenced"
}

func (pa *prometheusAlerts) getUserWorkloadAlertsViaAlertmanager(ctx context.Context) ([]PrometheusAlert, error) {
	alerts, err := pa.getAlertmanagerAlerts(ctx, UserWorkloadRouteNamespace, UserWorkloadAlertmanagerRouteName, AlertSourceUser)
	if err != nil {
		alerts, err = pa.getAlertmanagerAlertsViaService(ctx, UserWorkloadRouteNamespace, UserWorkloadAlertmanagerRouteName, UserWorkloadAlertmanagerPort, AlertSourceUser)
		if err != nil {
			return nil, err
		}
	}

	pending, err := pa.getAlertsViaProxy(ctx, UserWorkloadRouteNamespace, UserWorkloadRouteName, AlertSourceUser)
	if err != nil {
		pending, err = pa.getPrometheusAlertsViaService(ctx, UserWorkloadRouteNamespace, UserWorkloadPrometheusServiceName, UserWorkloadPrometheusPort, AlertSourceUser)
		if err != nil {
			return alerts, nil
		}
	}

	return append(alerts, filterAlertsByState(pending, "pending")...), nil
}

func (pa *prometheusAlerts) getPrometheusAlertsViaService(ctx context.Context, namespace string, serviceName string, port int32, source string) ([]PrometheusAlert, error) {
	if _, hasDeadline := ctx.Deadline(); !hasDeadline {
		timeoutCtx, cancel := context.WithTimeout(ctx, serviceRequestTimeout)
		defer cancel()
		ctx = timeoutCtx
	}

	raw, err := pa.getServiceResponse(ctx, namespace, serviceName, port, PrometheusAlertsPath)
	if err != nil {
		return nil, err
	}

	var alertsResp prometheusAlertsResponse
	if err := json.Unmarshal(raw, &alertsResp); err != nil {
		return nil, fmt.Errorf("decode prometheus response: %w", err)
	}

	if alertsResp.Status != "success" {
		return nil, fmt.Errorf("prometheus API returned non-success status: %s", alertsResp.Status)
	}

	applyAlertMetadata(alertsResp.Data.Alerts, source, AlertBackendProm)
	return alertsResp.Data.Alerts, nil
}

func (pa *prometheusAlerts) getAlertmanagerAlertsViaService(ctx context.Context, namespace string, serviceName string, port int32, source string) ([]PrometheusAlert, error) {
	raw, err := pa.getServiceResponse(ctx, namespace, serviceName, port, AlertmanagerAlertsPath)
	if err != nil {
		return nil, err
	}

	var amAlerts []alertmanagerAlert
	if err := json.Unmarshal(raw, &amAlerts); err != nil {
		return nil, fmt.Errorf("decode alertmanager response: %w", err)
	}

	converted := make([]PrometheusAlert, 0, len(amAlerts))
	for _, alert := range amAlerts {
		state := mapAlertmanagerState(alert.Status.State)
		if state == "" {
			continue
		}
		converted = append(converted, PrometheusAlert{
			Labels:      alert.Labels,
			Annotations: alert.Annotations,
			State:       state,
			ActiveAt:    alert.StartsAt,
		})
	}

	applyAlertMetadata(converted, source, AlertBackendAM)
	if len(converted) == 0 {
		return []PrometheusAlert{}, nil
	}
	return converted, nil
}

func (pa *prometheusAlerts) serviceReachable(ctx context.Context, namespace string, serviceName string, port int32, path string) bool {
	healthCtx, cancel := context.WithTimeout(ctx, serviceHealthTimeout)
	defer cancel()

	_, err := pa.getServiceResponse(healthCtx, namespace, serviceName, port, path)
	return err == nil
}

func (pa *prometheusAlerts) getServiceResponse(ctx context.Context, namespace string, serviceName string, port int32, path string) ([]byte, error) {
	baseURL := fmt.Sprintf("https://%s.%s.svc:%d", serviceName, namespace, port)
	requestURL := fmt.Sprintf("%s%s", baseURL, path)

	client, err := pa.createHTTPClient()
	if err != nil {
		return nil, err
	}

	return pa.executeRequest(ctx, client, requestURL)
}

func (pa *prometheusAlerts) thanosTenancyReachable(ctx context.Context, path string) bool {
	namespaces := pa.userRuleNamespaces(ctx)
	if len(namespaces) == 0 {
		return false
	}

	limit := maxTenancyProbeTargets
	if limit <= 0 || limit > len(namespaces) {
		limit = len(namespaces)
	}

	for i := 0; i < limit; i++ {
		healthCtx, cancel := context.WithTimeout(ctx, serviceHealthTimeout)
		_, err := pa.getThanosTenancyResponse(healthCtx, path, namespaces[i])
		cancel()

		if err == nil {
			return true
		}
		if isTenancyExpectedError(err) {
			continue
		}
		return false
	}

	return false
}

// isTenancyExpectedError returns true for errors that are expected when probing
// Thanos tenancy endpoints across user namespaces — e.g. the namespace has no
// rules (404), the SA lacks access (401/403), or the namespace is not yet
// instrumented. These are skipped; only a network/server error aborts the probe.
func isTenancyExpectedError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "status 401") ||
		strings.Contains(msg, "status 403") ||
		strings.Contains(msg, "status 404") ||
		strings.Contains(msg, "unauthorized") ||
		strings.Contains(msg, "forbidden") ||
		strings.Contains(msg, "not found")
}

func (pa *prometheusAlerts) getAlertsViaProxy(ctx context.Context, namespace string, routeName string, source string) ([]PrometheusAlert, error) {
	raw, err := pa.getPrometheusResponse(ctx, namespace, routeName, PrometheusAlertsPath)
	if err != nil {
		return nil, err
	}

	var alertsResp prometheusAlertsResponse
	if err := json.Unmarshal(raw, &alertsResp); err != nil {
		return nil, fmt.Errorf("decode prometheus response: %w", err)
	}

	if alertsResp.Status != "success" {
		return nil, fmt.Errorf("prometheus API returned non-success status: %s", alertsResp.Status)
	}

	applyAlertMetadata(alertsResp.Data.Alerts, source, AlertBackendProm)
	return alertsResp.Data.Alerts, nil
}

func (pa *prometheusAlerts) getAlertsViaThanosTenancy(ctx context.Context, namespace string, source string) ([]PrometheusAlert, error) {
	raw, err := pa.getThanosTenancyResponse(ctx, ThanosQuerierTenancyAlertsPath, namespace)
	if err != nil {
		return nil, err
	}

	var alertsResp prometheusAlertsResponse
	if err := json.Unmarshal(raw, &alertsResp); err != nil {
		return nil, fmt.Errorf("decode thanos response: %w", err)
	}

	if alertsResp.Status != "success" {
		return nil, fmt.Errorf("thanos API returned non-success status: %s", alertsResp.Status)
	}

	applyAlertMetadata(alertsResp.Data.Alerts, source, AlertBackendThanos)
	return alertsResp.Data.Alerts, nil
}

func (pa *prometheusAlerts) getAlertmanagerAlerts(ctx context.Context, namespace string, routeName string, source string) ([]PrometheusAlert, error) {
	raw, err := pa.getPrometheusResponse(ctx, namespace, routeName, AlertmanagerAlertsPath)
	if err != nil {
		return nil, err
	}

	var amAlerts []alertmanagerAlert
	if err := json.Unmarshal(raw, &amAlerts); err != nil {
		return nil, fmt.Errorf("decode alertmanager response: %w", err)
	}

	converted := make([]PrometheusAlert, 0, len(amAlerts))
	for _, alert := range amAlerts {
		state := mapAlertmanagerState(alert.Status.State)
		if state == "" {
			continue
		}
		converted = append(converted, PrometheusAlert{
			Labels:      alert.Labels,
			Annotations: alert.Annotations,
			State:       state,
			ActiveAt:    alert.StartsAt,
		})
	}

	applyAlertMetadata(converted, source, AlertBackendAM)
	if len(converted) == 0 {
		return []PrometheusAlert{}, nil
	}
	return converted, nil
}

func (pa *prometheusAlerts) getUserWorkloadRules(ctx context.Context, req GetRulesRequest) ([]PrometheusRuleGroup, error) {
	namespace := namespaceFromLabels(req.Labels)
	if namespace != "" {
		rules, err := pa.getRulesViaThanosTenancy(ctx, namespace, AlertSourceUser)
		if err == nil {
			return rules, nil
		}
		prometheusLog.Warnf("failed to get user workload rules via thanos tenancy: %v", err)
	}

	userNamespaces := pa.userRuleNamespaces(ctx)
	if len(userNamespaces) > 0 {
		groups, err := pa.getRulesViaThanosTenancyNamespaces(ctx, userNamespaces, AlertSourceUser)
		if err == nil {
			return groups, nil
		}
		prometheusLog.Warnf("failed to get user workload rules via thanos tenancy namespaces: %v", err)
	}

	return pa.getRulesViaProxy(ctx, UserWorkloadRouteNamespace, UserWorkloadRouteName, AlertSourceUser)
}

func (pa *prometheusAlerts) userRuleNamespaces(ctx context.Context) []string {
	if cached, ok := pa.nsCache.get(); ok {
		return cached
	}

	if pa.ruleManager == nil {
		namespaces := pa.allNonPlatformNamespaces(ctx)
		pa.nsCache.set(namespaces)
		return namespaces
	}

	prometheusRules, err := pa.ruleManager.List(ctx, "")
	if err != nil {
		prometheusLog.WithError(err).Warn("failed to list PrometheusRules for user namespace discovery")
		namespaces := pa.allNonPlatformNamespaces(ctx)
		pa.nsCache.set(namespaces)
		return namespaces
	}

	namespaces := map[string]struct{}{}
	for _, pr := range prometheusRules {
		if pr.Namespace == "" {
			continue
		}
		if pr.Namespace == PlatformRouteNamespace || pr.Namespace == UserWorkloadRouteNamespace {
			continue
		}
		namespaces[pr.Namespace] = struct{}{}
	}

	out := make([]string, 0, len(namespaces))
	for ns := range namespaces {
		out = append(out, ns)
	}
	pa.nsCache.set(out)
	return out
}

func (pa *prometheusAlerts) allNonPlatformNamespaces(ctx context.Context) []string {
	if pa.coreClient == nil {
		return nil
	}

	namespaceList, err := pa.coreClient.Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		prometheusLog.WithError(err).Warn("failed to list namespaces for user namespace discovery")
		return nil
	}

	out := make([]string, 0, len(namespaceList.Items))
	for _, ns := range namespaceList.Items {
		if ns.Name == PlatformRouteNamespace || ns.Name == UserWorkloadRouteNamespace {
			continue
		}
		out = append(out, ns.Name)
	}
	return out
}

// fanOutThanosTenancy calls fetch for each namespace, accumulates results, and
// returns combined results (or the last error if nothing succeeded).
func fanOutThanosTenancy[T any](namespaces []string, fetch func(string) ([]T, error)) ([]T, error) {
	var out []T
	var lastErr error
	for _, namespace := range namespaces {
		results, err := fetch(namespace)
		if err != nil {
			lastErr = err
			continue
		}
		out = append(out, results...)
	}
	if len(out) > 0 {
		return out, nil
	}
	return out, lastErr
}

func (pa *prometheusAlerts) getAlertsViaThanosTenancyNamespaces(ctx context.Context, namespaces []string, source string) ([]PrometheusAlert, error) {
	return fanOutThanosTenancy(namespaces, func(ns string) ([]PrometheusAlert, error) {
		return pa.getAlertsViaThanosTenancy(ctx, ns, source)
	})
}

func (pa *prometheusAlerts) getRulesViaThanosTenancyNamespaces(ctx context.Context, namespaces []string, source string) ([]PrometheusRuleGroup, error) {
	return fanOutThanosTenancy(namespaces, func(ns string) ([]PrometheusRuleGroup, error) {
		return pa.getRulesViaThanosTenancy(ctx, ns, source)
	})
}

func (pa *prometheusAlerts) getRulesViaProxy(ctx context.Context, namespace string, routeName string, source string) ([]PrometheusRuleGroup, error) {
	raw, err := pa.getPrometheusResponse(ctx, namespace, routeName, PrometheusRulesPath)
	if err != nil {
		return nil, err
	}

	var rulesResp prometheusRulesResponse
	if err := json.Unmarshal(raw, &rulesResp); err != nil {
		return nil, fmt.Errorf("decode prometheus response: %w", err)
	}

	if rulesResp.Status != "success" {
		return nil, fmt.Errorf("prometheus API returned non-success status: %s", rulesResp.Status)
	}

	applyRuleSource(rulesResp.Data.Groups, source)
	return rulesResp.Data.Groups, nil
}

func (pa *prometheusAlerts) getRulesViaThanosTenancy(ctx context.Context, namespace string, source string) ([]PrometheusRuleGroup, error) {
	raw, err := pa.getThanosTenancyResponse(ctx, ThanosQuerierTenancyRulesPath, namespace)
	if err != nil {
		return nil, err
	}

	var rulesResp prometheusRulesResponse
	if err := json.Unmarshal(raw, &rulesResp); err != nil {
		return nil, fmt.Errorf("decode thanos response: %w", err)
	}

	if rulesResp.Status != "success" {
		return nil, fmt.Errorf("thanos API returned non-success status: %s", rulesResp.Status)
	}

	applyRuleSource(rulesResp.Data.Groups, source)
	return rulesResp.Data.Groups, nil
}

func (pa *prometheusAlerts) getPrometheusResponse(ctx context.Context, namespace string, routeName string, path string) ([]byte, error) {
	url, err := pa.buildPrometheusURL(ctx, namespace, routeName, path)
	if err != nil {
		return nil, err
	}
	client, err := pa.createHTTPClient()
	if err != nil {
		return nil, err
	}

	return pa.executeRequest(ctx, client, url)
}

func (pa *prometheusAlerts) getThanosTenancyResponse(ctx context.Context, path string, namespace string) ([]byte, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace is required for thanos tenancy requests")
	}

	port := pa.resolveThanosTenancyRulesPort(ctx)
	baseURL := fmt.Sprintf("https://%s.%s.svc:%d", ThanosQuerierServiceName, ThanosQuerierNamespace, port)
	requestURL := fmt.Sprintf("%s%s?namespace=%s", baseURL, path, url.QueryEscape(namespace))

	client, err := pa.createHTTPClient()
	if err != nil {
		return nil, err
	}

	return pa.executeRequest(ctx, client, requestURL)
}

func (pa *prometheusAlerts) resolveThanosTenancyRulesPort(ctx context.Context) int32 {
	pa.thanosTenancyPortOnce.Do(func() {
		pa.thanosTenancyPort = pa.lookupThanosTenancyRulesPort(ctx)
	})
	return pa.thanosTenancyPort
}

func (pa *prometheusAlerts) lookupThanosTenancyRulesPort(ctx context.Context) int32 {
	if pa.coreClient == nil {
		return DefaultThanosQuerierTenancyRulesPort
	}

	service, err := pa.coreClient.Services(ThanosQuerierNamespace).Get(ctx, ThanosQuerierServiceName, metav1.GetOptions{})
	if err != nil {
		prometheusLog.WithError(err).Warnf("failed to resolve thanos-querier %s port, falling back to default %d", ThanosQuerierTenancyRulesPortName, DefaultThanosQuerierTenancyRulesPort)
		return DefaultThanosQuerierTenancyRulesPort
	}

	for _, port := range service.Spec.Ports {
		if port.Name == ThanosQuerierTenancyRulesPortName && port.Port > 0 {
			return port.Port
		}
	}

	prometheusLog.Warnf("thanos-querier service missing %s port, falling back to default %d", ThanosQuerierTenancyRulesPortName, DefaultThanosQuerierTenancyRulesPort)
	return DefaultThanosQuerierTenancyRulesPort
}

func (pa *prometheusAlerts) buildPrometheusURL(ctx context.Context, namespace string, routeName string, path string) (string, error) {
	route, err := pa.fetchPrometheusRoute(ctx, namespace, routeName)
	if err != nil {
		return "", err
	}

	return buildRouteURL(route.Spec.Host, route.Spec.Path, path), nil
}

func (pa *prometheusAlerts) fetchPrometheusRoute(ctx context.Context, namespace string, routeName string) (*routev1.Route, error) {
	if pa.routeClient == nil {
		return nil, fmt.Errorf("route client is not configured")
	}

	route, err := pa.routeClient.RouteV1().Routes(namespace).Get(ctx, routeName, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get prometheus route: %w", err)
	}

	return route, nil
}

func applyAlertMetadata(alerts []PrometheusAlert, source, backend string) {
	for i := range alerts {
		if alerts[i].Labels == nil {
			alerts[i].Labels = map[string]string{}
		}
		alerts[i].Labels[AlertSourceLabel] = source
		alerts[i].Labels[AlertBackendLabel] = backend
	}
}

func applyRuleSource(groups []PrometheusRuleGroup, source string) {
	for gi := range groups {
		for ri := range groups[gi].Rules {
			rule := &groups[gi].Rules[ri]
			if rule.Labels == nil {
				rule.Labels = map[string]string{}
			}
			rule.Labels[AlertSourceLabel] = source
			for ai := range rule.Alerts {
				if rule.Alerts[ai].Labels == nil {
					rule.Alerts[ai].Labels = map[string]string{}
				}
				rule.Alerts[ai].Labels[AlertSourceLabel] = source
			}
		}
	}
}

func filterAlertsByState(alerts []PrometheusAlert, state string) []PrometheusAlert {
	out := make([]PrometheusAlert, 0, len(alerts))
	for _, alert := range alerts {
		if alert.State == state {
			out = append(out, alert)
		}
	}
	return out
}

func mapAlertmanagerState(state string) string {
	if state == "active" {
		return "firing"
	}
	if state == "suppressed" {
		return "silenced"
	}
	return ""
}

func buildRouteURL(host string, routePath string, requestPath string) string {
	basePath := strings.TrimSuffix(routePath, "/")
	if basePath == "" {
		return fmt.Sprintf("https://%s%s", host, requestPath)
	}
	if requestPath == basePath || strings.HasPrefix(requestPath, basePath+"/") {
		return fmt.Sprintf("https://%s%s", host, requestPath)
	}
	return fmt.Sprintf("https://%s%s%s", host, basePath, requestPath)
}

func namespaceFromLabels(labels map[string]string) string {
	if labels == nil {
		return ""
	}
	return strings.TrimSpace(labels["namespace"])
}

func (pa *prometheusAlerts) createHTTPClient() (*http.Client, error) {
	tlsConfig, err := pa.buildTLSConfig()
	if err != nil {
		return nil, err
	}

	return &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: tlsConfig,
		},
	}, nil
}

func (pa *prometheusAlerts) buildTLSConfig() (*tls.Config, error) {
	caCertPool, err := pa.loadCACertPool()
	if err != nil {
		return nil, err
	}

	return &tls.Config{
		MinVersion: tls.VersionTLS12,
		RootCAs:    caCertPool,
	}, nil
}

func (pa *prometheusAlerts) loadCACertPool() (*x509.CertPool, error) {
	caCertPool, err := x509.SystemCertPool()
	if err != nil {
		caCertPool = x509.NewCertPool()
	}

	if len(pa.config.CAData) > 0 {
		caCertPool.AppendCertsFromPEM(pa.config.CAData)
		return caCertPool, nil
	}

	if pa.config.CAFile != "" {
		caCert, err := os.ReadFile(pa.config.CAFile)
		if err != nil {
			return nil, fmt.Errorf("read CA cert file: %w", err)
		}
		caCertPool.AppendCertsFromPEM(caCert)
	}

	// OpenShift service CA bundle for in-cluster service certs.
	if serviceCA, err := os.ReadFile(ServiceCAPath); err == nil {
		caCertPool.AppendCertsFromPEM(serviceCA)
	}

	return caCertPool, nil
}

func copyStringSlice(in []string) []string {
	if len(in) == 0 {
		return []string{}
	}

	out := make([]string, len(in))
	copy(out, in)
	return out
}

func (pa *prometheusAlerts) executeRequest(ctx context.Context, client *http.Client, url string) ([]byte, error) {
	req, err := pa.createAuthenticatedRequest(ctx, url)
	if err != nil {
		return nil, err
	}

	return pa.performRequest(client, req)
}

func (pa *prometheusAlerts) createAuthenticatedRequest(ctx context.Context, url string) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	token := bearerTokenFromContext(ctx)
	if token == "" {
		var err error
		token, err = pa.loadBearerToken()
		if err != nil {
			return nil, err
		}
	}

	req.Header.Set("Authorization", "Bearer "+token)
	return req, nil
}

func (pa *prometheusAlerts) loadBearerToken() (string, error) {
	if pa.config.BearerToken != "" {
		return pa.config.BearerToken, nil
	}

	if pa.config.BearerTokenFile == "" {
		return "", fmt.Errorf("no bearer token or token file configured")
	}

	tokenBytes, err := os.ReadFile(pa.config.BearerTokenFile)
	if err != nil {
		return "", fmt.Errorf("load bearer token file: %w", err)
	}

	return strings.TrimSpace(string(tokenBytes)), nil
}

func (pa *prometheusAlerts) performRequest(client *http.Client, req *http.Request) ([]byte, error) {
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	return body, nil
}

func labelsMatch(req *GetAlertsRequest, alert *PrometheusAlert) bool {
	for key, value := range req.Labels {
		if alertValue, exists := alert.Labels[key]; !exists || alertValue != value {
			return false
		}
	}

	return true
}
