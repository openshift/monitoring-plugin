package managementrouter_test

import (
	"testing"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

func TestHTTPRouter(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "HTTPRouter Suite")
}
