package management_test

import (
	"context"
	"errors"
	"time"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	osmv1 "github.com/openshift/api/monitoring/v1"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

var _ = Describe("GetAlerts", func() {
	var (
		ctx        context.Context
		mockK8s    *testutils.MockClient
		mockAlerts *testutils.MockPrometheusAlertsInterface
		mockMapper *testutils.MockMapperClient
		client     management.Client
		testTime   time.Time
	)

	BeforeEach(func() {
		ctx = context.Background()
		testTime = time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)

		mockAlerts = &testutils.MockPrometheusAlertsInterface{}
		mockK8s = &testutils.MockClient{
			PrometheusAlertsFunc: func() k8s.PrometheusAlertsInterface {
				return mockAlerts
			},
		}
		mockMapper = &testutils.MockMapperClient{}

		client = management.NewWithCustomMapper(ctx, mockK8s, mockMapper)
	})

	It("should return alerts unchanged when no relabel configs exist", func() {
		mockAlerts.SetActiveAlerts([]k8s.PrometheusAlert{
			{Labels: map[string]string{"alertname": "HighCPU", "severity": "warning"}, State: "firing", ActiveAt: testTime},
			{Labels: map[string]string{"alertname": "HighMemory", "severity": "critical"}, State: "pending", ActiveAt: testTime},
		})
		mockMapper.GetAlertRelabelConfigSpecFunc = func(*monitoringv1.Rule) []osmv1.RelabelConfig { return nil }

		result, err := client.GetAlerts(ctx, k8s.GetAlertsRequest{})

		Expect(err).ToNot(HaveOccurred())
		Expect(result).To(HaveLen(2))
		Expect(result[0].Labels["alertname"]).To(Equal("HighCPU"))
		Expect(result[1].Labels["alertname"]).To(Equal("HighMemory"))
	})

	It("should apply Replace relabel actions correctly", func() {
		mockAlerts.SetActiveAlerts([]k8s.PrometheusAlert{
			{
				Labels: map[string]string{"alertname": "TestAlert", "severity": "warning", "team": "platform"},
				State:  "firing",
			},
		})
		mockMapper.GetAlertRelabelConfigSpecFunc = func(rule *monitoringv1.Rule) []osmv1.RelabelConfig {
			return []osmv1.RelabelConfig{
				{TargetLabel: "severity", Replacement: "critical", Action: "Replace"},
				{TargetLabel: "team", Replacement: "infrastructure", Action: "Replace"},
				{TargetLabel: "reviewed", Replacement: "true", Action: "Replace"},
			}
		}

		result, err := client.GetAlerts(ctx, k8s.GetAlertsRequest{})

		Expect(err).ToNot(HaveOccurred())
		Expect(result).To(HaveLen(1))
		Expect(result[0].Labels).To(HaveKeyWithValue("severity", "critical"))
		Expect(result[0].Labels).To(HaveKeyWithValue("team", "infrastructure"))
		Expect(result[0].Labels).To(HaveKeyWithValue("reviewed", "true"))
	})

	It("should filter out alerts with Drop action", func() {
		mockAlerts.SetActiveAlerts([]k8s.PrometheusAlert{
			{Labels: map[string]string{"alertname": "KeepAlert", "severity": "warning"}, State: "firing", ActiveAt: testTime},
			{Labels: map[string]string{"alertname": "DropAlert", "severity": "info"}, State: "firing", ActiveAt: testTime},
		})
		mockMapper.GetAlertRelabelConfigSpecFunc = func(rule *monitoringv1.Rule) []osmv1.RelabelConfig {
			if rule.Alert == "DropAlert" {
				return []osmv1.RelabelConfig{{Action: "Drop"}}
			}
			return nil
		}

		result, err := client.GetAlerts(ctx, k8s.GetAlertsRequest{})

		Expect(err).ToNot(HaveOccurred())
		Expect(result).To(HaveLen(1))
		Expect(result[0].Labels["alertname"]).To(Equal("KeepAlert"))
	})

	It("should propagate errors and handle edge cases", func() {
		By("propagating errors from PrometheusAlerts interface")
		mockAlerts.GetAlertsFunc = func(context.Context, k8s.GetAlertsRequest) ([]k8s.PrometheusAlert, error) {
			return nil, errors.New("prometheus error")
		}
		_, err := client.GetAlerts(ctx, k8s.GetAlertsRequest{})
		Expect(err).To(HaveOccurred())
		Expect(err.Error()).To(ContainSubstring("prometheus error"))

		By("handling nil labels with Replace action")
		mockAlerts.GetAlertsFunc = nil
		mockAlerts.SetActiveAlerts([]k8s.PrometheusAlert{
			{Labels: map[string]string{"alertname": "TestAlert", "severity": "warning"}, State: "firing", ActiveAt: testTime},
		})
		mockMapper.GetAlertRelabelConfigSpecFunc = func(*monitoringv1.Rule) []osmv1.RelabelConfig {
			return []osmv1.RelabelConfig{{TargetLabel: "team", Replacement: "infra", Action: "Replace"}}
		}
		result, err := client.GetAlerts(ctx, k8s.GetAlertsRequest{})
		Expect(err).ToNot(HaveOccurred())
		Expect(result[0].Labels).To(HaveKeyWithValue("team", "infra"))
	})
})
