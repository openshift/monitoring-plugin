//go:build e2e

package e2e

import (
	"fmt"
	"os"
	"testing"

	"github.com/openshift/monitoring-plugin/test/e2e/framework"
)

func TestMain(m *testing.M) {
	cleanup, err := framework.EnsureUserWorkloadMonitoring()
	if err != nil {
		fmt.Fprintf(os.Stderr, "user workload monitoring: %v\n", err)
		os.Exit(1)
	}
	code := m.Run()
	if err := cleanup(); err != nil {
		fmt.Fprintf(os.Stderr, "restore user workload monitoring: %v\n", err)
		code = 1
	}
	os.Exit(code)
}
