package management

import "encoding/base64"

func classificationOverrideKey(ruleId string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(ruleId))
}

func OverrideConfigMapName(ruleNamespace string) string {
	return "alert-classification-overrides-" + ruleNamespace
}

func decodeClassificationOverrideKey(key string) (string, bool) {
	decoded, err := base64.RawURLEncoding.DecodeString(key)
	if err != nil {
		return "", false
	}
	return string(decoded), true
}
