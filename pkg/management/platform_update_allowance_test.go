package management

import (
	"fmt"
	"testing"
)

func TestAllowanceFromPreconditionError_UsesManagedByField(t *testing.T) {
	allowance := allowanceFromPreconditionError(notAllowedGitOpsEdit())
	if allowance.ManagedBy != ManagedByGitOps {
		t.Fatalf("got %q, want gitops", allowance.ManagedBy)
	}

	wrapped := fmt.Errorf("blocked: %w", notAllowedOperatorUpdate())
	allowance = allowanceFromPreconditionError(wrapped)
	if allowance.ManagedBy != ManagedByOperator {
		t.Fatalf("wrapped got %q, want operator", allowance.ManagedBy)
	}
}

func TestAllowanceFromPreconditionError_IgnoresMessageText(t *testing.T) {
	allowance := allowanceFromPreconditionError(&NotAllowedError{
		Message: "this mentions GitOps and operator but has no source field",
	})
	if allowance.ManagedBy != "" {
		t.Fatalf("expected empty ManagedBy from message-only error, got %q", allowance.ManagedBy)
	}
}
