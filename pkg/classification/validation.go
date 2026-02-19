package classification

import (
	"regexp"
	"strings"
)

var allowedLayers = map[string]struct{}{
	"cluster":   {},
	"namespace": {},
}

var labelValueRegexp = regexp.MustCompile(`^[A-Za-z0-9]([A-Za-z0-9_.-]*[A-Za-z0-9])?$`)
var labelNameRegexp = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

// ValidateLayer returns true if the provided layer is one of the allowed values.
func ValidateLayer(layer string) bool {
	_, ok := allowedLayers[strings.ToLower(strings.TrimSpace(layer))]
	return ok
}

// ValidateComponent returns true if the component is a reasonable label value.
// Accept 1-253 chars, [A-Za-z0-9._-], must start/end alphanumeric.
func ValidateComponent(component string) bool {
	c := strings.TrimSpace(component)
	if c == "" || len(c) > 253 {
		return false
	}
	return labelValueRegexp.MatchString(c)
}

func ValidatePromLabelName(name string) bool {
	return labelNameRegexp.MatchString(strings.TrimSpace(name))
}
