package k8s_test

import (
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/openshift/monitoring-plugin/pkg/k8s"
)

type testObject struct {
	metav1.ObjectMeta
}

func obj(annotations, labels map[string]string, owners []metav1.OwnerReference) *testObject {
	return &testObject{
		ObjectMeta: metav1.ObjectMeta{
			Annotations:     annotations,
			Labels:          labels,
			OwnerReferences: owners,
		},
	}
}

func TestIsExternallyManagedObject_NilObject(t *testing.T) {
	gitOps, operator := k8s.IsExternallyManagedObject(nil)
	if gitOps || operator {
		t.Errorf("nil object: expected (false, false), got (%v, %v)", gitOps, operator)
	}
}

func TestIsExternallyManagedObject_NoAnnotations(t *testing.T) {
	o := obj(nil, nil, nil)
	gitOps, operator := k8s.IsExternallyManagedObject(o)
	if gitOps || operator {
		t.Errorf("plain object: expected (false, false), got (%v, %v)", gitOps, operator)
	}
}

func TestIsExternallyManagedObject_ArgocdAnnotation(t *testing.T) {
	o := obj(map[string]string{"argocd.argoproj.io/tracking-id": "abc"}, nil, nil)
	gitOps, operator := k8s.IsExternallyManagedObject(o)
	if !gitOps {
		t.Error("expected gitOps=true for argocd annotation")
	}
	if operator {
		t.Error("expected operator=false when no owners")
	}
}

func TestIsExternallyManagedObject_ArgocdLabel(t *testing.T) {
	o := obj(nil, map[string]string{"argocd.argoproj.io/app-name": "myapp"}, nil)
	gitOps, _ := k8s.IsExternallyManagedObject(o)
	if !gitOps {
		t.Error("expected gitOps=true for argocd label")
	}
}

func TestIsExternallyManagedObject_ManagedByGitOpsLabel(t *testing.T) {
	o := obj(nil, map[string]string{"app.kubernetes.io/managed-by": "openshift-gitops"}, nil)
	gitOps, _ := k8s.IsExternallyManagedObject(o)
	if !gitOps {
		t.Error("expected gitOps=true for managed-by=openshift-gitops label")
	}
}

func TestIsExternallyManagedObject_OperatorOwnerRef(t *testing.T) {
	o := obj(nil, nil, []metav1.OwnerReference{{Kind: "Deployment", Name: "some-operator"}})
	gitOps, operator := k8s.IsExternallyManagedObject(o)
	if gitOps {
		t.Error("expected gitOps=false when no argocd markers")
	}
	if !operator {
		t.Error("expected operator=true when owner references exist")
	}
}

func TestIsExternallyManagedObject_BothGitOpsAndOperator(t *testing.T) {
	o := obj(
		map[string]string{"argocd.argoproj.io/tracking-id": "abc"},
		nil,
		[]metav1.OwnerReference{{Kind: "Deployment", Name: "some-operator"}},
	)
	gitOps, operator := k8s.IsExternallyManagedObject(o)
	if !gitOps || !operator {
		t.Errorf("expected (true, true), got (%v, %v)", gitOps, operator)
	}
}

func TestIsManagedByGitOps_ContainsGitOps(t *testing.T) {
	labels := map[string]string{"app.kubernetes.io/managed-by": "my-gitops-tool"}
	if !k8s.IsManagedByGitOps(nil, labels) {
		t.Error("expected true for label containing 'gitops'")
	}
}

func TestIsManagedByGitOps_ArgocdCluster(t *testing.T) {
	labels := map[string]string{"app.kubernetes.io/managed-by": "argocd-cluster"}
	if !k8s.IsManagedByGitOps(nil, labels) {
		t.Error("expected true for managed-by=argocd-cluster")
	}
}

func TestIsManagedByGitOps_UnrelatedLabel(t *testing.T) {
	labels := map[string]string{"app.kubernetes.io/managed-by": "helm"}
	if k8s.IsManagedByGitOps(nil, labels) {
		t.Error("expected false for managed-by=helm")
	}
}
