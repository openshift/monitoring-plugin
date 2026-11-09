package management

import (
	"fmt"
	"testing"
)

func TestAllowanceFromPreconditionError_UsesManagedByField(t *testing.T) {
	allowance := allowanceFromPreconditionError(notAllowedGitOpsEdit())
	if allowance.ManagedBy == nil || *allowance.ManagedBy != ManagedByGitOps {
		t.Fatalf("got %v, want gitops", allowance.ManagedBy)
	}

	wrapped := fmt.Errorf("blocked: %w", notAllowedOperatorUpdate())
	allowance = allowanceFromPreconditionError(wrapped)
	if allowance.ManagedBy == nil || *allowance.ManagedBy != ManagedByOperator {
		t.Fatalf("wrapped got %v, want operator", allowance.ManagedBy)
	}
}

func TestAllowanceFromPreconditionError_IgnoresMessageText(t *testing.T) {
	allowance := allowanceFromPreconditionError(&NotAllowedError{
		Message: "this mentions GitOps and operator but has no source field",
	})
	if allowance.ManagedBy != nil {
		t.Fatalf("expected nil ManagedBy from message-only error, got %v", *allowance.ManagedBy)
	}
}
