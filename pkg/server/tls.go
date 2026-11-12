package server

import (
	"crypto/tls"
	"fmt"
	"maps"
	"slices"
	"strings"
)

type supportedCurve struct {
	id    tls.CurveID
	tls12 bool // hybrid post-quantum groups are TLS 1.3 only
}

// Kept by hand: crypto/tls has no tls.CipherSuites() equivalent for curves.
var supportedCurves = []supportedCurve{
	{id: tls.X25519, tls12: true},
	{id: tls.CurveP256, tls12: true},
	{id: tls.CurveP384, tls12: true},
	{id: tls.CurveP521, tls12: true},
	{id: tls.X25519MLKEM768},
	{id: tls.SecP256r1MLKEM768},
	{id: tls.SecP384r1MLKEM1024},
}

// OpenShift API TLSGroup names that differ from the Go ones.
var curveAliases = map[string]tls.CurveID{
	"secp256r1": tls.CurveP256,
	"secp384r1": tls.CurveP384,
	"secp521r1": tls.CurveP521,
}

func ParseCipherSuites(ciphers string) ([]uint16, error) {
	known := make(map[string]uint16)
	for _, suite := range tls.CipherSuites() {
		known[strings.ToLower(suite.Name)] = suite.ID
	}
	return parseTLSList(ciphers, known, "cipher suites")
}

func CipherSuiteNames(ids []uint16) []string {
	names := make([]string, 0, len(ids))
	for _, id := range ids {
		names = append(names, tls.CipherSuiteName(id))
	}
	return names
}

func ParseCurves(curves string) ([]tls.CurveID, error) {
	known := maps.Clone(curveAliases)
	for _, c := range supportedCurves {
		known[strings.ToLower(c.id.String())] = c.id
	}
	return parseTLSList(curves, known, "curves")
}

func parseTLSList[T comparable](list string, known map[string]T, kind string) ([]T, error) {
	if strings.TrimSpace(list) == "" {
		return nil, nil
	}

	var values []T
	var unknown int
	for _, name := range strings.Split(strings.ReplaceAll(list, " ", ""), ",") {
		if name == "" {
			continue
		}
		v, ok := known[strings.ToLower(name)]
		if !ok {
			unknown++
			continue
		}
		if !slices.Contains(values, v) {
			values = append(values, v)
		}
	}

	if unknown > 0 {
		return nil, fmt.Errorf("%d unknown TLS %s configured", unknown, kind)
	}

	if len(values) == 0 {
		return nil, fmt.Errorf("no valid TLS %s configured", kind)
	}

	return values, nil
}

func isSupportedCipherSuite(id uint16) bool {
	return slices.ContainsFunc(tls.CipherSuites(), func(s *tls.CipherSuite) bool { return s.ID == id })
}

func isTLS12CipherSuite(id uint16) bool {
	return slices.ContainsFunc(tls.CipherSuites(), func(s *tls.CipherSuite) bool {
		return s.ID == id && slices.Contains(s.SupportedVersions, tls.VersionTLS12)
	})
}

func isSupportedCurve(id tls.CurveID) bool {
	return slices.ContainsFunc(supportedCurves, func(c supportedCurve) bool { return c.id == id })
}

func isTLS12Curve(id tls.CurveID) bool {
	return slices.ContainsFunc(supportedCurves, func(c supportedCurve) bool { return c.id == id && c.tls12 })
}

func newBaseTLSConfig(cfg *Config) (*tls.Config, error) {
	tlsConfig := &tls.Config{
		MinVersion:       tls.VersionTLS12,
		MaxVersion:       cfg.TLSMaxVersion,
		CipherSuites:     cfg.TLSCipherSuites,
		CurvePreferences: cfg.TLSCurvePreferences,
	}
	if cfg.TLSMinVersion != 0 {
		tlsConfig.MinVersion = cfg.TLSMinVersion
	}

	if tlsConfig.MaxVersion != 0 && tlsConfig.MaxVersion < tlsConfig.MinVersion {
		return nil, fmt.Errorf(
			"min TLS version %q greater than max TLS version %q",
			tls.VersionName(tlsConfig.MinVersion),
			tls.VersionName(tlsConfig.MaxVersion),
		)
	}

	for _, id := range tlsConfig.CipherSuites {
		if !isSupportedCipherSuite(id) {
			return nil, fmt.Errorf("unsupported TLS cipher suite %#04x", id)
		}
	}

	tls13Enabled := tlsConfig.MaxVersion == 0 || tlsConfig.MaxVersion >= tls.VersionTLS13

	// crypto/tls ignores CipherSuites for TLS 1.3, so a list of only TLS 1.3
	// suites leaves TLS 1.2 without any cipher to negotiate.
	if len(tlsConfig.CipherSuites) > 0 && tlsConfig.MinVersion < tls.VersionTLS13 &&
		!slices.ContainsFunc(tlsConfig.CipherSuites, isTLS12CipherSuite) {
		if !tls13Enabled {
			return nil, fmt.Errorf(
				"TLS cipher suites %q contain no TLS 1.2 cipher suite, but max TLS version is %q: no configured cipher suite can be negotiated",
				CipherSuiteNames(tlsConfig.CipherSuites),
				tls.VersionName(tlsConfig.MaxVersion),
			)
		}
		log.Warnf(
			"TLS cipher suites %q contain no TLS 1.2 cipher suite, but min TLS version is %q: TLS 1.2 clients will fail the handshake",
			CipherSuiteNames(tlsConfig.CipherSuites),
			tls.VersionName(tlsConfig.MinVersion),
		)
	}

	for _, id := range tlsConfig.CurvePreferences {
		if !isSupportedCurve(id) {
			return nil, fmt.Errorf("unsupported TLS curve %#04x", uint16(id))
		}
	}

	if len(tlsConfig.CurvePreferences) > 0 && !slices.ContainsFunc(tlsConfig.CurvePreferences, isTLS12Curve) {
		if !tls13Enabled {
			return nil, fmt.Errorf(
				"TLS curves %q only contain hybrid post-quantum groups which require TLS 1.3, but max TLS version is %q",
				tlsConfig.CurvePreferences,
				tls.VersionName(tlsConfig.MaxVersion),
			)
		}
		if tlsConfig.MinVersion < tls.VersionTLS13 {
			log.Warnf(
				"TLS curves %q only contain hybrid post-quantum groups which require TLS 1.3, but min TLS version is %q: TLS 1.2 clients will fail the handshake",
				tlsConfig.CurvePreferences,
				tls.VersionName(tlsConfig.MinVersion),
			)
		}
	}

	return tlsConfig, nil
}
