package alertrule

import (
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"sort"
	"strings"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
)

func GetAlertingRuleId(alertRule *monitoringv1.Rule) string {
	var kind, name string
	if alertRule.Alert != "" {
		kind = "alert"
		name = alertRule.Alert
	} else if alertRule.Record != "" {
		kind = "record"
		name = alertRule.Record
	} else {
		return ""
	}

	expr := strings.Join(strings.Fields(strings.TrimSpace(alertRule.Expr.String())), " ")
	forDuration := ""
	if alertRule.For != nil {
		forDuration = strings.TrimSpace(string(*alertRule.For))
	}

	var sortedLabels []string
	if alertRule.Labels != nil {
		for key, value := range alertRule.Labels {
			k := strings.TrimSpace(key)
			if k == "" {
				continue
			}
			if strings.HasPrefix(k, "openshift_io_") || k == "alertname" {
				// Skip system labels
				continue
			}
			if value == "" {
				continue
			}

			sortedLabels = append(sortedLabels, fmt.Sprintf("%s=%s", k, value))
		}
		sort.Strings(sortedLabels)
	}

	// Build the hash input string
	canonicalPayload := strings.Join([]string{
		kind,
		name,
		expr,
		forDuration,
		strings.Join(sortedLabels, "\n"),
	}, "\n---\n")

	// Generate SHA256 hash
	hash := sha256.Sum256([]byte(canonicalPayload))

	return "rid_" + base64.RawURLEncoding.EncodeToString(hash[:])
}
