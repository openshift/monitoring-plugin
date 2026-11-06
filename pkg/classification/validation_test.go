package classification

import (
	"strings"
	"testing"
)

func TestValidateComponent(t *testing.T) {
	tests := []struct {
		name      string
		component string
		valid     bool
	}{
		{name: "single character", component: "a", valid: true},
		{name: "identifier", component: "team_a.component-1", valid: true},
		{name: "VM component", component: "openshift-virtualization-virtual-machine", valid: true},
		{name: "operator component", component: "openshift-virtualization-operator", valid: true},
		{name: "trimmed component", component: "  openshift-virtualization-virtual-machine  ", valid: true},
		{name: "spaces", component: "OpenShift Virtualization Virtual Machine"},
		{name: "maximum length", component: strings.Repeat("a", 253), valid: true},
		{name: "too long", component: strings.Repeat("a", 254)},
		{name: "empty"},
		{name: "whitespace", component: "   "},
		{name: "leading punctuation", component: "-component"},
		{name: "trailing punctuation", component: "component-"},
		{name: "tab", component: "Virtual\tMachine"},
		{name: "newline", component: "Virtual\nMachine"},
		{name: "slash", component: "Virtual/Machine"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ValidateComponent(tt.component); got != tt.valid {
				t.Errorf("ValidateComponent(%q) = %t, want %t", tt.component, got, tt.valid)
			}
		})
	}
}
