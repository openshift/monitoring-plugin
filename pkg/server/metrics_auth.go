package server

import (
	"context"
	"crypto/x509"
	"fmt"
	"net/http"

	"k8s.io/apiserver/pkg/server/dynamiccertificates"
)

const metricsScraperIdentity = "system:serviceaccount:openshift-monitoring:prometheus-k8s"

// metricsClientCA loads the client CA bundle mounted by the operator and keeps
// it synchronized with the file. Scrapes keep using the last valid bundle in
// memory while the file is missing or invalid.
func metricsClientCA(ctx context.Context, filename string) (dynamiccertificates.CAContentProvider, error) {
	ca, err := dynamiccertificates.NewDynamicCAContentFromFile("metrics-client-ca", filename)
	if err != nil {
		return nil, fmt.Errorf("failed to load metrics client CA bundle: %w", err)
	}
	go ca.Run(ctx, 1)
	return ca, nil
}

// authorizeMetrics verifies that the client connection uses a TLS certificate
// signed by the expected CA and identifying the in-cluster Prometheus service
// account.
func authorizeMetrics(ca dynamiccertificates.CAContentProvider, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.TLS == nil || len(r.TLS.PeerCertificates) == 0 {
			http.Error(w, "client certificate required", http.StatusUnauthorized)
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

// denyAllMetrics rejects every scrape. It is used when TLS is enabled but no
// client CA bundle is configured: client certificates cannot be verified, so
// the endpoint fails closed instead of serving unauthenticated.
func denyAllMetrics(_ http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "metrics client CA unavailable", http.StatusServiceUnavailable)
	})
}
