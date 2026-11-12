package server

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net/http"

	"k8s.io/apiserver/pkg/server/dynamiccertificates"
	"k8s.io/client-go/kubernetes"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

const metricsScraperIdentity = "system:serviceaccount:openshift-monitoring:prometheus-k8s"

// metricsClientCA follows the metrics client CA bundle published by CMO. Authentication
// and authorization during a scrape use only the last loaded bundle, so an
// API server outage does not interrupt scrapes. Until it loads, access fails
// closed while the controller retries in the background.
func metricsClientCA(ctx context.Context, client kubernetes.Interface) (dynamiccertificates.CAContentProvider, error) {
	if client == nil {
		return nil, nil
	}
	ca, err := dynamiccertificates.NewDynamicCAFromConfigMapController(
		"metrics-client-ca", k8s.ClusterMonitoringNamespace, "metrics-client-ca", "client-ca.crt", client,
	)
	if err != nil {
		return nil, fmt.Errorf("create metrics client CA controller: %w", err)
	}
	go ca.Run(ctx, 1)
	return ca, nil
}

// authorizeMetrics verifies the certificate itself rather than trusting the
// presented subject or forwarded identity headers. Other routes can continue
// accepting connections without a client certificate.
func authorizeMetrics(ca dynamiccertificates.CAContentProvider, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.TLS == nil || len(r.TLS.PeerCertificates) == 0 {
			http.Error(w, "client certificate required", http.StatusUnauthorized)
			return
		}
		if ca == nil {
			http.Error(w, "metrics client CA unavailable", http.StatusServiceUnavailable)
			return
		}
		opts, available := ca.VerifyOptions()
		if !available {
			http.Error(w, "metrics client CA unavailable", http.StatusServiceUnavailable)
			return
		}
		opts.KeyUsages = []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}
		opts.Intermediates = x509.NewCertPool()
		for _, intermediate := range r.TLS.PeerCertificates[1:] {
			opts.Intermediates.AddCert(intermediate)
		}
		cert := r.TLS.PeerCertificates[0]
		if _, err := cert.Verify(opts); err != nil {
			http.Error(w, "invalid client certificate", http.StatusUnauthorized)
			return
		}
		if cert.Subject.CommonName != metricsScraperIdentity {
			http.Error(w, "metrics access denied", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// requestMetricsClientCertificate also applies to dynamically reloaded serving
// certificates. A missing client certificate is rejected only by /metrics.
func requestMetricsClientCertificate(config *tls.Config) {
	config.ClientAuth = tls.RequestClientCert
	getConfig := config.GetConfigForClient
	if getConfig != nil {
		config.GetConfigForClient = func(hello *tls.ClientHelloInfo) (*tls.Config, error) {
			current, err := getConfig(hello)
			if err != nil || current == nil {
				return current, err
			}
			current = current.Clone()
			current.ClientAuth = tls.RequestClientCert
			return current, nil
		}
	}
}
