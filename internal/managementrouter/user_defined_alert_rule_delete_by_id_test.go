package managementrouter_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/mapper"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

var _ = Describe("DeleteUserDefinedAlertRuleById", func() {
	var (
		router       http.Handler
		mockK8sRules *testutils.MockPrometheusRuleInterface
		mockK8s      *testutils.MockClient
		mockMapper   *testutils.MockMapperClient
	)

	BeforeEach(func() {
		mockK8sRules = &testutils.MockPrometheusRuleInterface{}

		userPR := monitoringv1.PrometheusRule{}
		userPR.Name = "user-pr"
		userPR.Namespace = "default"
		userPR.Spec.Groups = []monitoringv1.RuleGroup{
			{
				Name:  "g1",
				Rules: []monitoringv1.Rule{{Alert: "u1"}, {Alert: "u2"}},
			},
		}

		platformPR := monitoringv1.PrometheusRule{}
		platformPR.Name = "platform-pr"
		platformPR.Namespace = "openshift-monitoring"
		platformPR.Spec.Groups = []monitoringv1.RuleGroup{
			{
				Name:  "pg1",
				Rules: []monitoringv1.Rule{{Alert: "p1"}},
			},
		}

		mockK8sRules.SetPrometheusRules(map[string]*monitoringv1.PrometheusRule{
			"default/user-pr":                  &userPR,
			"openshift-monitoring/platform-pr": &platformPR,
		})

		mockK8s = &testutils.MockClient{
			PrometheusRulesFunc: func() k8s.PrometheusRuleInterface {
				return mockK8sRules
			},
		}
	})

	Context("when ruleId is missing or blank", func() {
		It("returns 400 with missing ruleId message", func() {
			mgmt := management.NewWithCustomMapper(context.Background(), mockK8s, mockMapper)
			router = managementrouter.New(mgmt)

			req := httptest.NewRequest(http.MethodDelete, "/api/v1/alerting/rules/%20", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusBadRequest))
			Expect(w.Body.String()).To(ContainSubstring("missing ruleId"))
		})
	})

	Context("when deletion succeeds", func() {
		It("deletes a user-defined rule and keeps the other intact", func() {
			mockMapper = &testutils.MockMapperClient{
				GetAlertingRuleIdFunc: func(rule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
					return mapper.PrometheusAlertRuleId(rule.Alert)
				},
				FindAlertRuleByIdFunc: func(alertRuleId mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
					pr := mapper.PrometheusRuleId{
						Namespace: "default",
						Name:      "user-pr",
					}
					return &pr, nil
				},
			}

			mgmt := management.NewWithCustomMapper(context.Background(), mockK8s, mockMapper)
			router = managementrouter.New(mgmt)

			req := httptest.NewRequest(http.MethodDelete, "/api/v1/alerting/rules/u1", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusNoContent))

			pr, found, err := mockK8sRules.Get(context.Background(), "default", "user-pr")
			Expect(found).To(BeTrue())
			Expect(err).NotTo(HaveOccurred())
			ruleNames := []string{}
			for _, g := range pr.Spec.Groups {
				for _, r := range g.Rules {
					ruleNames = append(ruleNames, r.Alert)
				}
			}
			Expect(ruleNames).NotTo(ContainElement("u1"))
			Expect(ruleNames).To(ContainElement("u2"))
		})
	})

	Context("when rule is not found", func() {
		It("returns 404 with expected message", func() {
			mockMapper = &testutils.MockMapperClient{
				FindAlertRuleByIdFunc: func(alertRuleId mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
					return nil, fmt.Errorf("alert rule not found")
				},
			}
			mgmt := management.NewWithCustomMapper(context.Background(), mockK8s, mockMapper)
			router = managementrouter.New(mgmt)

			req := httptest.NewRequest(http.MethodDelete, "/api/v1/alerting/rules/missing", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusNotFound))
			Expect(w.Body.String()).To(ContainSubstring("AlertRule with id missing not found"))
		})
	})

	Context("when platform rule", func() {
		It("rejects platform rule deletion and PR remains unchanged", func() {
			mockMapper = &testutils.MockMapperClient{
				GetAlertingRuleIdFunc: func(rule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
					return mapper.PrometheusAlertRuleId(rule.Alert)
				},
				FindAlertRuleByIdFunc: func(alertRuleId mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
					pr := mapper.PrometheusRuleId{
						Namespace: "openshift-monitoring",
						Name:      "platform-pr",
					}
					return &pr, nil
				},
			}

			mgmt := management.NewWithCustomMapper(context.Background(), mockK8s, mockMapper)
			router = managementrouter.New(mgmt)

			req := httptest.NewRequest(http.MethodDelete, "/api/v1/alerting/rules/p1", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			Expect(w.Code).To(Equal(http.StatusMethodNotAllowed))
			Expect(w.Body.String()).To(ContainSubstring("cannot delete alert rule from a platform-managed PrometheusRule"))

			pr, found, err := mockK8sRules.Get(context.Background(), "openshift-monitoring", "platform-pr")
			Expect(found).To(BeTrue())
			Expect(err).NotTo(HaveOccurred())
			for _, g := range pr.Spec.Groups {
				for _, r := range g.Rules {
					if r.Alert == "p1" {
						found = true
					}
				}
			}
			Expect(found).To(BeTrue())
		})
	})
})
