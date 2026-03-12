//go:build e2e

package framework

import (
	"errors"
	"testing"
	"time"
)

func TestRetry_SucceedsOnFirstAttempt(t *testing.T) {
	calls := 0
	err := retry(3, func() error {
		calls++
		return nil
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if calls != 1 {
		t.Errorf("expected 1 call, got %d", calls)
	}
}

func TestRetry_SucceedsAfterTransientFailures(t *testing.T) {
	calls := 0
	err := retry(3, func() error {
		calls++
		if calls < 3 {
			return errors.New("transient")
		}
		return nil
	})
	if err != nil {
		t.Fatalf("expected no error after retry, got %v", err)
	}
	if calls != 3 {
		t.Errorf("expected 3 calls, got %d", calls)
	}
}

func TestRetry_ExhaustsAttempts(t *testing.T) {
	calls := 0
	err := retry(3, func() error {
		calls++
		return errors.New("persistent")
	})
	if err == nil {
		t.Fatal("expected error after exhausting retries")
	}
	if calls != 3 {
		t.Errorf("expected 3 calls, got %d", calls)
	}
}

func TestRetry_ZeroAttempts(t *testing.T) {
	calls := 0
	err := retry(0, func() error {
		calls++
		return errors.New("should not be called")
	})
	if err != nil {
		t.Fatalf("expected nil with 0 attempts, got %v", err)
	}
	if calls != 0 {
		t.Errorf("expected 0 calls with n=0, got %d", calls)
	}
}

func TestPoll_SucceedsImmediately(t *testing.T) {
	err := Poll(time.Millisecond, 50*time.Millisecond, func() error {
		return nil
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestPoll_FailsOnTimeout(t *testing.T) {
	calls := 0
	err := Poll(time.Millisecond, 50*time.Millisecond, func() error {
		calls++
		return errors.New("still failing")
	})
	if err == nil {
		t.Fatal("expected error on timeout")
	}
}
