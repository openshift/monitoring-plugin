package management

import (
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	osmv1 "github.com/openshift/api/monitoring/v1"
)

var _ = Describe("applyRelabelConfigs", func() {
	Context("when Drop action is applied", func() {
		It("should return error", func() {
			initialLabels := map[string]string{
				"severity": "critical",
			}
			configs := []osmv1.RelabelConfig{
				{
					Action: "Drop",
				},
			}

			result, err := applyRelabelConfigs("TestAlert", initialLabels, configs)

			Expect(err).To(HaveOccurred())
			Expect(result).To(BeNil())
		})
	})

	Context("when Replace action is applied", func() {
		It("should update existing label", func() {
			initialLabels := map[string]string{
				"severity": "warning",
			}
			configs := []osmv1.RelabelConfig{
				{
					Action:      "Replace",
					TargetLabel: "severity",
					Replacement: "critical",
				},
			}

			result, err := applyRelabelConfigs("TestAlert", initialLabels, configs)

			Expect(err).ToNot(HaveOccurred())
			Expect(result).To(Equal(map[string]string{
				"severity": "critical",
			}))
		})

		It("should add new label", func() {
			initialLabels := map[string]string{
				"severity": "warning",
			}
			configs := []osmv1.RelabelConfig{
				{
					Action:      "Replace",
					TargetLabel: "team",
					Replacement: "platform",
				},
			}

			result, err := applyRelabelConfigs("TestAlert", initialLabels, configs)

			Expect(err).ToNot(HaveOccurred())
			Expect(result).To(Equal(map[string]string{
				"severity": "warning",
				"team":     "platform",
			}))
		})

		It("should work with nil labels", func() {
			configs := []osmv1.RelabelConfig{
				{
					Action:      "Replace",
					TargetLabel: "severity",
					Replacement: "critical",
				},
			}

			result, err := applyRelabelConfigs("TestAlert", nil, configs)

			Expect(err).ToNot(HaveOccurred())
			Expect(result).To(Equal(map[string]string{
				"severity": "critical",
			}))
		})
	})

	Context("when multiple Replace actions are applied", func() {
		It("should apply all replacements", func() {
			initialLabels := map[string]string{
				"severity": "warning",
			}
			configs := []osmv1.RelabelConfig{
				{
					Action:      "Replace",
					TargetLabel: "severity",
					Replacement: "critical",
				},
				{
					Action:      "Replace",
					TargetLabel: "team",
					Replacement: "platform",
				},
			}

			result, err := applyRelabelConfigs("TestAlert", initialLabels, configs)

			Expect(err).ToNot(HaveOccurred())
			Expect(result).To(Equal(map[string]string{
				"severity": "critical",
				"team":     "platform",
			}))
		})
	})

	Context("when Keep action is applied", func() {
		It("should be a no-op", func() {
			initialLabels := map[string]string{
				"severity": "warning",
			}
			configs := []osmv1.RelabelConfig{
				{
					Action: "Keep",
				},
			}

			result, err := applyRelabelConfigs("TestAlert", initialLabels, configs)

			Expect(err).ToNot(HaveOccurred())
			Expect(result).To(Equal(map[string]string{
				"severity": "warning",
			}))
		})
	})

	Context("when unknown action is applied", func() {
		It("should be ignored", func() {
			initialLabels := map[string]string{
				"severity": "warning",
			}
			configs := []osmv1.RelabelConfig{
				{
					Action: "UnknownAction",
				},
			}

			result, err := applyRelabelConfigs("TestAlert", initialLabels, configs)

			Expect(err).ToNot(HaveOccurred())
			Expect(result).To(Equal(map[string]string{
				"severity": "warning",
			}))
		})
	})

	Context("when no configs are provided", func() {
		It("should return unchanged labels", func() {
			initialLabels := map[string]string{
				"severity": "warning",
			}
			configs := []osmv1.RelabelConfig{}

			result, err := applyRelabelConfigs("TestAlert", initialLabels, configs)

			Expect(err).ToNot(HaveOccurred())
			Expect(result).To(Equal(map[string]string{
				"severity": "warning",
			}))
		})
	})
})
