package server

import (
	"context"
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

// authorizeMetrics authorizes /metrics scrapes. The connection must have
// presented a client certificate that was verified at TLS handshake time
// against the operator-managed CA bundle (see createHTTPServer), and the
// certificate must identify the in-cluster Prometheus service account.
func authorizeMetrics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.TLS == nil || len(r.TLS.VerifiedChains) == 0 {
			http.Error(w, "client certificate required", http.StatusUnauthorized)
			return
		}
		if r.TLS.PeerCertificates[0].Subject.CommonName != metricsScraperIdentity {
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
		http.Error(w, "metrics client CA unavailable", http.StatusUnauthorized)
	})
}
