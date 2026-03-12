package management_test

import (
	"os"
	"testing"

	"github.com/prometheus/common/model"
)

func TestMain(m *testing.M) {
	// LegacyValidation is required for tests that construct relabel configs
	// containing label names with special characters (e.g. slashes).
	model.NameValidationScheme = model.LegacyValidation //nolint:staticcheck
	os.Exit(m.Run())
}
