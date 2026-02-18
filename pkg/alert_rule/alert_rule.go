package alertrule

import (
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/openshift/monitoring-plugin/pkg/classification"
	"github.com/openshift/monitoring-plugin/pkg/managementlabels"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
)

func GetAlertingRuleId(alertRule *monitoringv1.Rule) string {
	var name string
	var kind string
	if alertRule.Alert != "" {
		name = alertRule.Alert
		kind = "alert"
	} else if alertRule.Record != "" {
		name = alertRule.Record
		kind = "record"
	} else {
		return ""
	}

	expr := normalizeExpr(alertRule.Expr.String())
	forDuration := ""
	if alertRule.For != nil {
		forDuration = strings.TrimSpace(string(*alertRule.For))
	}

	labelsBlock := normalizedBusinessLabelsBlock(alertRule.Labels)

	// Canonical payload is intentionally derived from rule spec (expr/for/labels) and identity (kind/name),
	// and excludes annotations and openshift_io_* provenance/system labels.
	canonicalPayload := strings.Join([]string{kind, name, expr, forDuration, labelsBlock}, "\n---\n")

	// Generate SHA256 hash
	hash := sha256.Sum256([]byte(canonicalPayload))

	return "rid_" + base64.RawURLEncoding.EncodeToString(hash[:])
}

func normalizeExpr(expr string) string {
	// Collapse consecutive whitespace so cosmetic formatting changes do not churn ids.
	return strings.Join(strings.Fields(strings.TrimSpace(expr)), " ")
}

func normalizedBusinessLabelsBlock(in map[string]string) string {
	if len(in) == 0 {
		return ""
	}

	lines := make([]string, 0, len(in))
	for k, v := range in {
		key := strings.TrimSpace(k)
		if key == "" {
			continue
		}
		if strings.HasPrefix(key, "openshift_io_") || key == managementlabels.AlertNameLabel {
			// Skip system labels
			continue
		}
		if !classification.ValidatePromLabelName(key) {
			continue
		}
		if v == "" {
			// Align with specHash behavior: drop empty values
			continue
		}
		if !utf8.ValidString(v) {
			continue
		}

		lines = append(lines, fmt.Sprintf("%s=%s", key, v))
	}

	sort.Strings(lines)
	return strings.Join(lines, "\n")
}
