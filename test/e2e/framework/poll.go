//go:build e2e

package framework

import (
	"context"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/util/wait"
)

// Poll calls f every interval until it returns nil or timeout elapses.
// On timeout the last observed error is wrapped with wait.ErrWaitTimeout.
func Poll(interval, timeout time.Duration, f func() error) error {
	var lastErr error
	err := wait.PollUntilContextTimeout(context.Background(), interval, timeout, true, func(context.Context) (bool, error) {
		if lastErr = f(); lastErr != nil {
			return false, nil
		}
		return true, nil
	})
	if err != nil && lastErr != nil {
		return fmt.Errorf("%w: %w", err, lastErr)
	}
	return err
}

// retry calls f up to n times, returning the last error on failure.
func retry(n int, f func() error) error {
	var err error
	for i := 0; i < n; i++ {
		if err = f(); err == nil {
			return nil
		}
	}
	return err
}
