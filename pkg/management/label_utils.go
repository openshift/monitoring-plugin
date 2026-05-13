package management

import "strings"

var validSeverities = map[string]bool{
	"critical": true,
	"warning":  true,
	"info":     true,
	"none":     true,
}

func isValidSeverity(s string) bool {
	return validSeverities[strings.ToLower(s)]
}
