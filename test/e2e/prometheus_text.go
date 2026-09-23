package e2e

import (
	"fmt"
	"strings"

	dto "github.com/prometheus/client_model/go"
	"github.com/prometheus/common/expfmt"
	"github.com/prometheus/common/model"
)

func metricSampleValue(body, name string) (float64, error) {
	parser := expfmt.NewTextParser(model.UTF8Validation)
	families, err := parser.TextToMetricFamilies(strings.NewReader(body))
	if err != nil {
		return 0, fmt.Errorf("parse prometheus text: %w", err)
	}
	family, ok := families[name]
	if !ok {
		return 0, fmt.Errorf("metric %s not found", name)
	}
	var sum float64
	for _, sample := range family.GetMetric() {
		value, err := metricPointValue(family.GetType(), sample)
		if err != nil {
			return 0, err
		}
		sum += value
	}
	return sum, nil
}

func metricPointValue(metricType dto.MetricType, sample *dto.Metric) (float64, error) {
	switch metricType {
	case dto.MetricType_GAUGE:
		return sample.GetGauge().GetValue(), nil
	case dto.MetricType_COUNTER:
		return sample.GetCounter().GetValue(), nil
	case dto.MetricType_UNTYPED:
		return sample.GetUntyped().GetValue(), nil
	default:
		return 0, fmt.Errorf("unsupported metric type %v", metricType)
	}
}
