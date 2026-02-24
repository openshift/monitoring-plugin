package managementrouter

import "encoding/json"

// AlertRuleClassificationPatch represents a partial update ("patch") payload for
// alert rule classification labels.
//
// This type supports a three-state contract per field:
// - omitted: leave unchanged
// - null: clear the override
// - string: set the override
//
// Note: Go's encoding/json cannot represent "explicit null" vs "omitted" using **string
// (both decode to nil), so we custom-unmarshal and track key presence with *Set flags.
type AlertRuleClassificationPatch struct {
	Component        *string `json:"openshift_io_alert_rule_component,omitempty"`
	ComponentSet     bool    `json:"-"`
	Layer            *string `json:"openshift_io_alert_rule_layer,omitempty"`
	LayerSet         bool    `json:"-"`
	ComponentFrom    *string `json:"openshift_io_alert_rule_component_from,omitempty"`
	ComponentFromSet bool    `json:"-"`
	LayerFrom        *string `json:"openshift_io_alert_rule_layer_from,omitempty"`
	LayerFromSet     bool    `json:"-"`
}

func (p *AlertRuleClassificationPatch) UnmarshalJSON(b []byte) error {
	var m map[string]json.RawMessage
	if err := json.Unmarshal(b, &m); err != nil {
		return err
	}

	decodeNullableString := func(key string) (set bool, v *string, err error) {
		raw, ok := m[key]
		if !ok {
			return false, nil, nil
		}
		set = true
		if len(raw) == 0 || string(raw) == "null" {
			return true, nil, nil
		}
		var s string
		if err := json.Unmarshal(raw, &s); err != nil {
			return true, nil, err
		}
		return true, &s, nil
	}

	var err error
	p.ComponentSet, p.Component, err = decodeNullableString("openshift_io_alert_rule_component")
	if err != nil {
		return err
	}
	p.LayerSet, p.Layer, err = decodeNullableString("openshift_io_alert_rule_layer")
	if err != nil {
		return err
	}
	p.ComponentFromSet, p.ComponentFrom, err = decodeNullableString("openshift_io_alert_rule_component_from")
	if err != nil {
		return err
	}
	p.LayerFromSet, p.LayerFrom, err = decodeNullableString("openshift_io_alert_rule_layer_from")
	if err != nil {
		return err
	}
	return nil
}
