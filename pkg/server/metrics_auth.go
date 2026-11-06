package server

import (
	"context"
	"crypto/x509"
	"fmt"
	"net/http"

	"k8s.io/apiserver/pkg/server/dynamiccertificates"
)

const metricsScraperIdentity = "system:serviceaccount:openshift-monitoring:prometheus-k8s"

// metricsClientCA reloads the client CA bundle mounted by the operator. Scrapes
// use the last valid bundle in memory, independently of API server availability.
func metricsClientCA(ctx context.Context, filename string) (dynamiccertificates.CAContentProvider, error) {
	if filename == "" {
		return nil, nil
	}
	ca, err := dynamiccertificates.NewDynamicCAContentFromFile("metrics-client-ca", filename)
	if err != nil {
		return nil, fmt.Errorf("load metrics client CA bundle: %w", err)
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
