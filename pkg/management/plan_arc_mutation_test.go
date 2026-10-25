package management

import "testing"

func TestComputeARCRestoreMutation_NilARC(t *testing.T) {
	result := computeARCRestoreMutation("rule-id", nil)
	if !result.noOp {
		t.Fatalf("expected no-op for nil ARC, got %+v", result)
	}
	if result.deleteARC {
		t.Fatal("expected deleteARC=false for nil ARC")
	}
}
