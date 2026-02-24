package managementrouter_test

import (
	"encoding/json"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	"github.com/openshift/monitoring-plugin/internal/managementrouter"
)

var _ = Describe("AlertRuleClassificationPatch", func() {
	Context("when field is omitted", func() {
		It("does not mark it as set", func() {
			var p managementrouter.AlertRuleClassificationPatch
			Expect(json.Unmarshal([]byte(`{}`), &p)).To(Succeed())
			Expect(p.ComponentSet).To(BeFalse())
			Expect(p.Component).To(BeNil())
		})
	})

	Context("when field is explicitly null", func() {
		It("marks it as set and clears the value", func() {
			var p managementrouter.AlertRuleClassificationPatch
			Expect(json.Unmarshal([]byte(`{"openshift_io_alert_rule_component":null}`), &p)).To(Succeed())
			Expect(p.ComponentSet).To(BeTrue())
			Expect(p.Component).To(BeNil())
		})
	})

	Context("when field is a string", func() {
		It("marks it as set and provides the value", func() {
			var p managementrouter.AlertRuleClassificationPatch
			Expect(json.Unmarshal([]byte(`{"openshift_io_alert_rule_component":"team-x"}`), &p)).To(Succeed())
			Expect(p.ComponentSet).To(BeTrue())
			Expect(p.Component).NotTo(BeNil())
			Expect(*p.Component).To(Equal("team-x"))
		})
	})
})
