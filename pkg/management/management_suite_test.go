package management_test

import (
	"testing"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"github.com/prometheus/common/model"
)

var _ = BeforeSuite(func() {
	// Set validation scheme globally for all tests that use relabel configs
	model.NameValidationScheme = model.LegacyValidation
})

func TestManagement(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Management Suite")
}
