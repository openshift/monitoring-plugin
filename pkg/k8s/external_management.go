package k8s

import (
	"reflect"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// External management detection keys
const (
	ArgocdArgoprojIoPrefix   = "argocd.argoproj.io/"
	AppKubernetesIoManagedBy = "app.kubernetes.io/managed-by"
)

// IsManagedByGitOps returns true if the provided annotations/labels indicate GitOps (e.g., ArgoCD) management.
func IsManagedByGitOps(annotations map[string]string, labels map[string]string) bool {
	for k := range annotations {
		if strings.HasPrefix(k, ArgocdArgoprojIoPrefix) {
			return true
		}
	}
	for k := range labels {
		if strings.HasPrefix(k, ArgocdArgoprojIoPrefix) {
			return true
		}
	}
	if v, ok := labels[AppKubernetesIoManagedBy]; ok {
		vl := strings.ToLower(strings.TrimSpace(v))
		if vl == "openshift-gitops" || vl == "argocd-cluster" || vl == "argocd" || strings.Contains(vl, "gitops") {
			return true
		}
	}
	return false
}

// IsExternallyManagedObject returns whether an object is GitOps-managed and/or operator-managed.
func IsExternallyManagedObject(obj metav1.Object) (gitOpsManaged bool, operatorManaged bool) {
	if obj == nil {
		return false, false
	}
	// Handle typed-nil underlying values
	if rv := reflect.ValueOf(obj); rv.Kind() == reflect.Ptr && rv.IsNil() {
		return false, false
	}
	gitOpsManaged = IsManagedByGitOps(obj.GetAnnotations(), obj.GetLabels())
	operatorManaged = len(obj.GetOwnerReferences()) > 0
	return
}
