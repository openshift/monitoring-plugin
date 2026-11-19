//go:build e2e

package e2e

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/tools/portforward"
	"k8s.io/client-go/transport/spdy"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management/metrics"
	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

const (
	pluginDeploymentName = "monitoring-plugin"
	leaderPollInterval   = 5 * time.Second
	leaderPollTimeout    = 3 * time.Minute
	// exclusivePollTimeout bounds the per-replica emission check, which
	// scrapes every ready replica and may wait for the holder's first
	// sync to complete.
	exclusivePollTimeout = 2 * time.Minute
	// apiRequestTimeout bounds individual API requests so a stalled call
	// cannot hang the test phase that started it.
	apiRequestTimeout = 30 * time.Second
)

// TestAlertMetricsElectsSingleLeader verifies that with multiple plugin
// replicas available, only a single replica is elected as the alert-metrics
// leader: the holder of the monitoring-plugin-metrics Lease must be one of
// the ready plugin pods, and only the holder serves the alert metric
// families.
func TestAlertMetricsElectsSingleLeader(t *testing.T) {
	f, err := framework.New()
	if err != nil {
		t.Fatalf("Failed to create framework: %v", err)
	}

	// Deployment setup requests get a bounded context of their own,
	// independent of the polling contexts below.
	setupCtx, cancelSetup := context.WithTimeout(context.Background(), apiRequestTimeout)
	defer cancelSetup()
	deployments := f.Clientset.AppsV1().Deployments(k8s.ClusterMonitoringNamespace)

	deployment, err := deployments.Get(setupCtx, pluginDeploymentName, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("Failed to get deployment %s/%s: %v", k8s.ClusterMonitoringNamespace, pluginDeploymentName, err)
	}

	originalReplicas := int32(1)
	if deployment.Spec.Replicas != nil {
		originalReplicas = *deployment.Spec.Replicas
	}

	// The operator deploys two replicas by default; scale up when running
	// against a cluster configured differently, and restore afterwards.
	if originalReplicas < 2 {
		t.Logf("Scaling %s from %d to 2 replicas for the leader-election check", pluginDeploymentName, originalReplicas)
		scaled := deployment.DeepCopy()
		replicas := int32(2)
		scaled.Spec.Replicas = &replicas
		if _, err := deployments.Update(setupCtx, scaled, metav1.UpdateOptions{}); err != nil {
			t.Fatalf("Failed to scale deployment %s to 2 replicas: %v", pluginDeploymentName, err)
		}
		defer func() {
			// Restoration runs after the polling contexts may have
			// expired, so it creates its own bounded context.
			restoreCtx, cancelRestore := context.WithTimeout(context.Background(), apiRequestTimeout)
			defer cancelRestore()
			// Read the deployment fresh: restoring the object fetched at
			// test start could revert operator changes made meanwhile.
			current, err := deployments.Get(restoreCtx, pluginDeploymentName, metav1.GetOptions{})
			if err != nil {
				t.Logf("Failed to get deployment %s for restore: %v", pluginDeploymentName, err)
				return
			}
			restored := current.DeepCopy()
			restored.Spec.Replicas = &originalReplicas
			if _, err := deployments.Update(restoreCtx, restored, metav1.UpdateOptions{}); err != nil {
				t.Logf("Failed to restore deployment %s replicas to %d: %v", pluginDeploymentName, originalReplicas, err)
			}
		}()
	}

	podSelector := metav1.FormatLabelSelector(deployment.Spec.Selector)

	// The polling context bounds every request the callback makes, so a
	// stalled call is cancelled when the poll budget is exhausted.
	pollCtx, cancelPoll := context.WithTimeout(context.Background(), leaderPollTimeout)
	defer cancelPoll()

	// Wait for at least two ready replicas and a Lease holder that is one of
	// them. The holder is the single replica emitting the alert metrics.
	var holder string
	err = framework.Poll(leaderPollInterval, leaderPollTimeout, func() error {
		_, _, current, _, err := pluginReplicas(pollCtx, f, podSelector)
		if err != nil {
			return err
		}
		holder = current
		return nil
	})
	if err != nil {
		t.Fatalf("Timeout waiting for a single leader among the plugin replicas: %v", err)
	}

	t.Logf("Lease %s is held by a single ready replica: %s", k8s.MetricsLeaderLeaseName, holder)

	// Exclusive emission: scrape every ready replica directly, bypassing
	// the shared route, and require alert samples only from the holder.
	// The Lease holder can change mid-check, as the pods are scraped one
	// after another and a replica could grab the Lease right after its
	// scrape. Re-reading the Lease after sampling and comparing the holder
	// and its transition count before/after therefore guards the whole
	// sampling window; on any change the check retries from scratch.
	checkCtx, cancelCheck := context.WithTimeout(context.Background(), exclusivePollTimeout)
	defer cancelCheck()

	var holderSamples int
	err = framework.Poll(leaderPollInterval, exclusivePollTimeout, func() error {
		pods, ready, current, transitions, err := pluginReplicas(checkCtx, f, podSelector)
		if err != nil {
			return err
		}
		port, err := pluginMetricsPort(checkCtx, f, pods)
		if err != nil {
			return err
		}
		for name := range ready {
			body, err := scrapePodMetrics(checkCtx, f, name, port)
			if err != nil {
				return err
			}
			samples := countAlertSamples(body)
			switch {
			case name == current && samples == 0:
				return fmt.Errorf("holder %s does not serve %s samples yet", name, metrics.MetricName)
			case name != current && samples > 0:
				return fmt.Errorf("replica %s also serves alert metric samples; expected them only from the holder %s", name, current)
			}
			if name == current {
				holderSamples = samples
			}
		}
		holderAfter, transitionsAfter, err := metricsLeaseState(checkCtx, f)
		if err != nil {
			return err
		}
		if holderAfter != current || transitionsAfter != transitions {
			return fmt.Errorf(
				"leadership changed while sampling the replicas (holder %s -> %s, transitions %d -> %d), retrying",
				current, holderAfter, transitions, transitionsAfter,
			)
		}
		holder = current
		return nil
	})
	if err != nil {
		t.Fatalf("Timeout verifying that only the Lease holder serves %s samples: %v", metrics.MetricName, err)
	}
	t.Logf("Alert metric samples are served only by the leader %s (%d series)", holder, holderSamples)
}

// pluginReplicas lists the plugin pods, the subset that is ready, and the
// current metrics Lease holder together with its transition count. It
// returns an error while fewer than two replicas are ready or the holder is
// not one of them, which makes it directly usable inside poll callbacks.
func pluginReplicas(ctx context.Context, f *framework.Framework, podSelector string) (*corev1.PodList, map[string]struct{}, string, int32, error) {
	pods, err := f.Clientset.CoreV1().Pods(k8s.ClusterMonitoringNamespace).List(ctx, metav1.ListOptions{
		LabelSelector: podSelector,
	})
	if err != nil {
		return nil, nil, "", 0, err
	}

	ready := make(map[string]struct{})
	for _, pod := range pods.Items {
		for _, condition := range pod.Status.Conditions {
			if condition.Type == corev1.PodReady && condition.Status == corev1.ConditionTrue {
				ready[pod.Name] = struct{}{}
				break
			}
		}
	}
	if len(ready) < 2 {
		return nil, nil, "", 0, fmt.Errorf("waiting for ready plugin replicas: %d/%d", len(ready), 2)
	}

	holder, transitions, err := metricsLeaseState(ctx, f)
	if err != nil {
		return nil, nil, "", 0, err
	}
	if holder == "" {
		return nil, nil, "", 0, fmt.Errorf("waiting for the %s Lease to be acquired", k8s.MetricsLeaderLeaseName)
	}

	// Check the freshly read holder against this iteration's ready set; a
	// holder from a previous iteration may have been replaced since.
	if _, ok := ready[holder]; !ok {
		return nil, nil, "", 0, fmt.Errorf("waiting for the Lease holder %s to be a ready plugin pod", holder)
	}
	return pods, ready, holder, transitions, nil
}

// metricsLeaseState reads the current metrics Lease holder and its
// transition count. Sampling code compares the state before and after a
// scrape window to detect a leadership change that happened mid-check.
func metricsLeaseState(ctx context.Context, f *framework.Framework) (string, int32, error) {
	lease, err := f.Clientset.CoordinationV1().Leases(k8s.ClusterMonitoringNamespace).Get(
		ctx, k8s.MetricsLeaderLeaseName, metav1.GetOptions{},
	)
	if err != nil {
		return "", 0, err
	}
	holder := ""
	if lease.Spec.HolderIdentity != nil {
		holder = *lease.Spec.HolderIdentity
	}
	transitions := int32(0)
	if lease.Spec.LeaseTransitions != nil {
		transitions = *lease.Spec.LeaseTransitions
	}
	return holder, transitions, nil
}

// pluginMetricsPort resolves the plugin container port serving /metrics by
// following the service's named port to the pod spec.
func pluginMetricsPort(ctx context.Context, f *framework.Framework, pods *corev1.PodList) (int32, error) {
	service, err := f.Clientset.CoreV1().Services(k8s.ClusterMonitoringNamespace).Get(ctx, pluginDeploymentName, metav1.GetOptions{})
	if err != nil {
		return 0, fmt.Errorf("get %s service: %w", pluginDeploymentName, err)
	}
	var target intstr.IntOrString
	found := false
	for _, port := range service.Spec.Ports {
		if port.Name == "https" {
			target, found = port.TargetPort, true
			break
		}
	}
	if !found {
		return 0, fmt.Errorf("service %s exposes no https port", pluginDeploymentName)
	}
	for _, pod := range pods.Items {
		for _, container := range pod.Spec.Containers {
			for _, port := range container.Ports {
				if target.Type == intstr.String {
					if port.Name == target.String() {
						return port.ContainerPort, nil
					}
					continue
				}
				if port.ContainerPort == int32(target.IntValue()) {
					return port.ContainerPort, nil
				}
			}
		}
	}
	return 0, fmt.Errorf("no plugin container port matches service target port %s", target.String())
}

// scrapePodMetrics scrapes /metrics from one specific plugin pod through an
// API-server port forward, so the result is tied to that replica instead of
// whichever backend the shared route happens to pick. The metrics endpoint
// authenticates the scrape client certificate, which requires the TLS
// session to reach the pod itself.
func scrapePodMetrics(ctx context.Context, f *framework.Framework, podName string, port int32) (string, error) {
	roundTripper, upgrader, err := spdy.RoundTripperFor(f.RestConfig)
	if err != nil {
		return "", fmt.Errorf("create port-forward transport: %w", err)
	}
	apiURL, err := url.Parse(f.RestConfig.Host)
	if err != nil {
		return "", fmt.Errorf("parse API server URL: %w", err)
	}
	apiURL.Path = fmt.Sprintf("/api/v1/namespaces/%s/pods/%s/portforward", k8s.ClusterMonitoringNamespace, podName)
	dialer := spdy.NewDialer(upgrader, &http.Client{Transport: roundTripper}, http.MethodPost, apiURL)

	ready := make(chan struct{})
	stop := make(chan struct{})
	forwarder, err := portforward.NewOnAddresses(
		dialer,
		[]string{"127.0.0.1"},
		[]string{fmt.Sprintf("0:%d", port)},
		stop,
		ready,
		os.Stderr,
		os.Stderr,
	)
	if err != nil {
		return "", fmt.Errorf("create port forward to pod %s: %w", podName, err)
	}

	forwardErr := make(chan error, 1)
	go func() {
		forwardErr <- forwarder.ForwardPorts()
	}()
	// Closing stop unblocks ForwardPorts, which closes the stream and its
	// listeners itself.
	defer close(stop)

	select {
	case <-ready:
	case err := <-forwardErr:
		return "", fmt.Errorf("port forward to pod %s: %w", podName, err)
	case <-ctx.Done():
		return "", fmt.Errorf("port forward to pod %s: %w", podName, ctx.Err())
	}

	ports, err := forwarder.GetPorts()
	if err != nil {
		return "", fmt.Errorf("read local port-forward port: %w", err)
	}
	return scrapeMetrics(ctx, f, fmt.Sprintf("https://127.0.0.1:%d", ports[0].Local))
}

// countAlertSamples counts sample lines of the alert metric families. Every
// replica serves the families' HELP/TYPE exposition, so comment lines are
// ignored: only the holder reports samples.
func countAlertSamples(body string) int {
	count := 0
	for _, line := range strings.Split(body, "\n") {
		if strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, metrics.MetricName) || strings.HasPrefix(line, metrics.DroppedMetricName) {
			count++
		}
	}
	return count
}
