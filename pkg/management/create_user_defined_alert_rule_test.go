package management_test

import (
	"context"
	"errors"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	monitoringv1 "github.com/prometheus-operator/prometheus-operator/pkg/apis/monitoring/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
	"github.com/openshift/monitoring-plugin/pkg/management"
	"github.com/openshift/monitoring-plugin/pkg/management/mapper"
	"github.com/openshift/monitoring-plugin/pkg/management/testutils"
)

var _ = Describe("CreateUserDefinedAlertRule", func() {
	var (
		ctx        context.Context
		mockK8s    *testutils.MockClient
		mockPR     *testutils.MockPrometheusRuleInterface
		mockMapper *testutils.MockMapperClient
		client     management.Client
	)

	BeforeEach(func() {
		ctx = context.Background()

		mockPR = &testutils.MockPrometheusRuleInterface{}
		mockK8s = &testutils.MockClient{
			PrometheusRulesFunc: func() k8s.PrometheusRuleInterface {
				return mockPR
			},
		}
		mockMapper = &testutils.MockMapperClient{}

		client = management.NewWithCustomMapper(ctx, mockK8s, mockMapper)
	})

	Context("when creating a user-defined alert rule", func() {
		It("should successfully create with default group name", func() {
			By("setting up test data")
			alertRule := monitoringv1.Rule{
				Alert: "TestAlert",
				Expr:  intstr.FromString("up == 0"),
				Labels: map[string]string{
					"severity": "warning",
				},
				Annotations: map[string]string{
					"summary": "Test alert",
				},
			}

			prOptions := management.PrometheusRuleOptions{
				Name:      "test-rule",
				Namespace: "test-namespace",
			}

			ruleId := "test-rule-id"
			mockMapper.GetAlertingRuleIdFunc = func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				return mapper.PrometheusAlertRuleId(ruleId)
			}
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return nil, errors.New("not found")
			}

			addRuleCalled := false
			var capturedGroupName string
			mockPR.AddRuleFunc = func(ctx context.Context, nn types.NamespacedName, groupName string, rule monitoringv1.Rule) error {
				addRuleCalled = true
				capturedGroupName = groupName
				Expect(nn.Name).To(Equal("test-rule"))
				Expect(nn.Namespace).To(Equal("test-namespace"))
				Expect(rule.Alert).To(Equal("TestAlert"))
				return nil
			}

			By("creating the alert rule")
			returnedId, err := client.CreateUserDefinedAlertRule(ctx, alertRule, prOptions)

			By("verifying the result")
			Expect(err).ToNot(HaveOccurred())
			Expect(returnedId).To(Equal(ruleId))
			Expect(addRuleCalled).To(BeTrue())
			Expect(capturedGroupName).To(Equal("user-defined-rules"))
		})

		It("should successfully create with custom group name", func() {
			By("setting up test data")
			alertRule := monitoringv1.Rule{
				Alert: "CustomGroupAlert",
				Expr:  intstr.FromString("memory_usage > 90"),
			}

			prOptions := management.PrometheusRuleOptions{
				Name:      "custom-rule",
				Namespace: "custom-namespace",
				GroupName: "custom-group",
			}

			ruleId := "custom-rule-id"
			mockMapper.GetAlertingRuleIdFunc = func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				return mapper.PrometheusAlertRuleId(ruleId)
			}
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return nil, errors.New("not found")
			}

			var capturedGroupName string
			mockPR.AddRuleFunc = func(ctx context.Context, nn types.NamespacedName, groupName string, rule monitoringv1.Rule) error {
				capturedGroupName = groupName
				return nil
			}

			By("creating the alert rule")
			returnedId, err := client.CreateUserDefinedAlertRule(ctx, alertRule, prOptions)

			By("verifying the result")
			Expect(err).ToNot(HaveOccurred())
			Expect(returnedId).To(Equal(ruleId))
			Expect(capturedGroupName).To(Equal("custom-group"))
		})

		It("should return error when namespace is missing", func() {
			By("setting up test data with missing namespace")
			alertRule := monitoringv1.Rule{
				Alert: "TestAlert",
				Expr:  intstr.FromString("up == 0"),
			}

			prOptions := management.PrometheusRuleOptions{
				Name:      "test-rule",
				Namespace: "",
			}

			By("attempting to create the alert rule")
			_, err := client.CreateUserDefinedAlertRule(ctx, alertRule, prOptions)

			By("verifying the error")
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("PrometheusRule Name and Namespace must be specified"))
		})

		It("should return error when name is missing", func() {
			By("setting up test data with missing name")
			alertRule := monitoringv1.Rule{
				Alert: "TestAlert",
				Expr:  intstr.FromString("up == 0"),
			}

			prOptions := management.PrometheusRuleOptions{
				Name:      "",
				Namespace: "test-namespace",
			}

			By("attempting to create the alert rule")
			_, err := client.CreateUserDefinedAlertRule(ctx, alertRule, prOptions)

			By("verifying the error")
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("PrometheusRule Name and Namespace must be specified"))
		})

		It("should return error when trying to add to platform-managed PrometheusRule", func() {
			By("setting up test data with platform-managed PrometheusRule name")
			alertRule := monitoringv1.Rule{
				Alert: "TestAlert",
				Expr:  intstr.FromString("up == 0"),
			}

			prOptions := management.PrometheusRuleOptions{
				Name:      "openshift-platform-alerts",
				Namespace: "openshift-monitoring",
			}

			By("attempting to create the alert rule")
			_, err := client.CreateUserDefinedAlertRule(ctx, alertRule, prOptions)

			By("verifying the error")
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("cannot add user-defined alert rule to a platform-managed PrometheusRule"))
		})

		It("should return error when rule with same config already exists", func() {
			By("setting up test data")
			alertRule := monitoringv1.Rule{
				Alert: "DuplicateAlert",
				Expr:  intstr.FromString("up == 0"),
			}

			prOptions := management.PrometheusRuleOptions{
				Name:      "test-rule",
				Namespace: "test-namespace",
			}

			ruleId := "duplicate-rule-id"
			mockMapper.GetAlertingRuleIdFunc = func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				return mapper.PrometheusAlertRuleId(ruleId)
			}
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				// Return success, indicating the rule already exists
				return &mapper.PrometheusRuleId{
					Namespace: "test-namespace",
					Name:      "test-rule",
				}, nil
			}

			By("attempting to create the duplicate alert rule")
			_, err := client.CreateUserDefinedAlertRule(ctx, alertRule, prOptions)

			By("verifying the error")
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("alert rule with exact config already exists"))
		})

		It("should return error when AddRule fails", func() {
			By("setting up test data")
			alertRule := monitoringv1.Rule{
				Alert: "TestAlert",
				Expr:  intstr.FromString("up == 0"),
			}

			prOptions := management.PrometheusRuleOptions{
				Name:      "test-rule",
				Namespace: "test-namespace",
			}

			ruleId := "test-rule-id"
			mockMapper.GetAlertingRuleIdFunc = func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				return mapper.PrometheusAlertRuleId(ruleId)
			}
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return nil, errors.New("not found")
			}

			expectedError := errors.New("failed to add rule to kubernetes")
			mockPR.AddRuleFunc = func(ctx context.Context, nn types.NamespacedName, groupName string, rule monitoringv1.Rule) error {
				return expectedError
			}

			By("attempting to create the alert rule")
			_, err := client.CreateUserDefinedAlertRule(ctx, alertRule, prOptions)

			By("verifying the error is propagated")
			Expect(err).To(HaveOccurred())
			Expect(err).To(Equal(expectedError))
		})
	})

	Context("when dealing with edge cases", func() {
		It("should handle alert rule with no labels or annotations", func() {
			By("setting up minimal alert rule")
			alertRule := monitoringv1.Rule{
				Alert: "MinimalAlert",
				Expr:  intstr.FromString("up == 0"),
			}

			prOptions := management.PrometheusRuleOptions{
				Name:      "minimal-rule",
				Namespace: "test-namespace",
			}

			ruleId := "minimal-rule-id"
			mockMapper.GetAlertingRuleIdFunc = func(alertRule *monitoringv1.Rule) mapper.PrometheusAlertRuleId {
				return mapper.PrometheusAlertRuleId(ruleId)
			}
			mockMapper.FindAlertRuleByIdFunc = func(id mapper.PrometheusAlertRuleId) (*mapper.PrometheusRuleId, error) {
				return nil, errors.New("not found")
			}

			addRuleCalled := false
			mockPR.AddRuleFunc = func(ctx context.Context, nn types.NamespacedName, groupName string, rule monitoringv1.Rule) error {
				addRuleCalled = true
				Expect(rule.Labels).To(BeNil())
				Expect(rule.Annotations).To(BeNil())
				return nil
			}

			By("creating the minimal alert rule")
			returnedId, err := client.CreateUserDefinedAlertRule(ctx, alertRule, prOptions)

			By("verifying the result")
			Expect(err).ToNot(HaveOccurred())
			Expect(returnedId).To(Equal(ruleId))
			Expect(addRuleCalled).To(BeTrue())
		})

		It("should reject PrometheusRules in openshift- prefixed namespaces", func() {
			By("setting up test data with openshift- namespace prefix")
			alertRule := monitoringv1.Rule{
				Alert: "TestAlert",
				Expr:  intstr.FromString("up == 0"),
			}

			prOptions := management.PrometheusRuleOptions{
				Name:      "custom-rule",
				Namespace: "openshift-user-namespace",
			}

			By("attempting to create the alert rule")
			_, err := client.CreateUserDefinedAlertRule(ctx, alertRule, prOptions)

			By("verifying the error")
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("cannot add user-defined alert rule to a platform-managed PrometheusRule"))
		})
	})
})
