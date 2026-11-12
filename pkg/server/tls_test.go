package server

import (
	"crypto/tls"
	"testing"

	"github.com/sirupsen/logrus"
	"github.com/sirupsen/logrus/hooks/test"
	"github.com/stretchr/testify/require"
)

func TestParseCurves(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []tls.CurveID
	}{
		{
			name:     "empty string returns nil to use Go defaults",
			input:    "",
			expected: nil,
		},
		{
			name:     "single Go curve name",
			input:    "X25519",
			expected: []tls.CurveID{tls.X25519},
		},
		{
			name:  "all Go curve names",
			input: "X25519,CurveP256,CurveP384,CurveP521,X25519MLKEM768,SecP256r1MLKEM768,SecP384r1MLKEM1024",
			expected: []tls.CurveID{
				tls.X25519, tls.CurveP256, tls.CurveP384, tls.CurveP521,
				tls.X25519MLKEM768, tls.SecP256r1MLKEM768, tls.SecP384r1MLKEM1024,
			},
		},
		{
			name:     "OpenShift TLSGroup aliases",
			input:    "secp256r1,secp384r1,secp521r1",
			expected: []tls.CurveID{tls.CurveP256, tls.CurveP384, tls.CurveP521},
		},
		{
			name:     "mixed Go names and OpenShift aliases",
			input:    "X25519MLKEM768,secp256r1,CurveP384",
			expected: []tls.CurveID{tls.X25519MLKEM768, tls.CurveP256, tls.CurveP384},
		},
		{
			name:     "names are matched case-insensitively",
			input:    "x25519,SECP384R1,curvep256,x25519mlkem768",
			expected: []tls.CurveID{tls.X25519, tls.CurveP384, tls.CurveP256, tls.X25519MLKEM768},
		},
		{
			name:     "spaces around names are ignored",
			input:    " X25519 , CurveP256 ",
			expected: []tls.CurveID{tls.X25519, tls.CurveP256},
		},
		{
			name:     "empty entries are skipped",
			input:    "X25519,,CurveP256,",
			expected: []tls.CurveID{tls.X25519, tls.CurveP256},
		},
		{
			name:     "duplicates, including aliases of the same curve, are removed keeping the first position",
			input:    "CurveP256,X25519,secp256r1,curvep256,X25519",
			expected: []tls.CurveID{tls.CurveP256, tls.X25519},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			curves, err := ParseCurves(tt.input)
			require.NoError(t, err)
			require.Equal(t, tt.expected, curves)
		})
	}
}

func TestParseCurvesFails(t *testing.T) {
	tests := []struct {
		input     string
		expectErr string
	}{
		{input: "X25519,NotACurve,CurveP256", expectErr: "1 unknown TLS curves configured"},
		{input: "NotACurve,AlsoNotACurve", expectErr: "2 unknown TLS curves configured"},
		{input: "p384", expectErr: "1 unknown TLS curves configured"},
		{input: ",,", expectErr: "no valid TLS curves configured"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			curves, err := ParseCurves(tt.input)
			require.EqualError(t, err, tt.expectErr)
			require.Nil(t, curves)
		})
	}
}

func TestParseCipherSuites(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []uint16
	}{
		{
			name:     "empty string returns nil to use Go defaults",
			input:    "",
			expected: nil,
		},
		{
			name:  "Go cipher suite names",
			input: "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,TLS_AES_128_GCM_SHA256",
			expected: []uint16{
				tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256, tls.TLS_AES_128_GCM_SHA256,
			},
		},
		{
			name:     "names are matched case-insensitively",
			input:    "tls_ecdhe_rsa_with_aes_128_gcm_sha256",
			expected: []uint16{tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256},
		},
		{
			name:     "spaces and empty entries are ignored",
			input:    " TLS_AES_128_GCM_SHA256 ,, ",
			expected: []uint16{tls.TLS_AES_128_GCM_SHA256},
		},
		{
			name:     "duplicates are removed keeping the first position",
			input:    "TLS_AES_128_GCM_SHA256,TLS_AES_256_GCM_SHA384,tls_aes_128_gcm_sha256",
			expected: []uint16{tls.TLS_AES_128_GCM_SHA256, tls.TLS_AES_256_GCM_SHA384},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ciphers, err := ParseCipherSuites(tt.input)
			require.NoError(t, err)
			require.Equal(t, tt.expected, ciphers)
		})
	}
}

func TestParseCipherSuitesFails(t *testing.T) {
	tests := []struct {
		input     string
		expectErr string
	}{
		{input: "TLS_AES_128_GCM_SHA256,ECDHE-RSA-AES128-GCM-SHA256", expectErr: "1 unknown TLS cipher suites configured"},
		{input: "NotACipher", expectErr: "1 unknown TLS cipher suites configured"},
		{input: "NotACipher,TLS_AES_128_GCM_SHA256,AlsoNotACipher", expectErr: "2 unknown TLS cipher suites configured"},
		{input: ",,", expectErr: "no valid TLS cipher suites configured"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			ciphers, err := ParseCipherSuites(tt.input)
			require.EqualError(t, err, tt.expectErr)
			require.Nil(t, ciphers)
		})
	}
}

func TestCipherSuiteNames(t *testing.T) {
	require.Empty(t, CipherSuiteNames(nil))
	require.Equal(t,
		[]string{"TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256", "TLS_AES_128_GCM_SHA256"},
		CipherSuiteNames([]uint16{tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256, tls.TLS_AES_128_GCM_SHA256}),
	)
}

func TestNewBaseTLSConfig(t *testing.T) {
	pqOnly := []tls.CurveID{tls.X25519MLKEM768, tls.SecP256r1MLKEM768, tls.SecP384r1MLKEM1024}
	tls13Only := []uint16{tls.TLS_AES_128_GCM_SHA256, tls.TLS_AES_256_GCM_SHA384}

	tests := []struct {
		name        string
		cfg         Config
		expected    *tls.Config
		expectErr   string
		expectWarns bool
	}{
		{
			name:     "defaults to TLS 1.2 minimum and Go default ciphers and curves",
			cfg:      Config{},
			expected: &tls.Config{MinVersion: tls.VersionTLS12},
		},
		{
			name: "applies custom versions, ciphers and curves",
			cfg: Config{
				TLSMinVersion:       tls.VersionTLS12,
				TLSMaxVersion:       tls.VersionTLS13,
				TLSCipherSuites:     []uint16{tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256},
				TLSCurvePreferences: []tls.CurveID{tls.CurveP384, tls.X25519MLKEM768},
			},
			expected: &tls.Config{
				MinVersion:       tls.VersionTLS12,
				MaxVersion:       tls.VersionTLS13,
				CipherSuites:     []uint16{tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256},
				CurvePreferences: []tls.CurveID{tls.CurveP384, tls.X25519MLKEM768},
			},
		},
		{
			name:      "rejects min version greater than max version",
			cfg:       Config{TLSMinVersion: tls.VersionTLS13, TLSMaxVersion: tls.VersionTLS12},
			expectErr: "min TLS version",
		},
		{
			name:      "rejects curve IDs not supported by crypto/tls",
			cfg:       Config{TLSCurvePreferences: []tls.CurveID{tls.CurveP256, tls.CurveID(0x1234)}},
			expectErr: "unsupported TLS curve",
		},
		{
			name:      "rejects cipher suite IDs not supported by crypto/tls",
			cfg:       Config{TLSCipherSuites: []uint16{tls.TLS_AES_128_GCM_SHA256, 0x1234}},
			expectErr: "unsupported TLS cipher suite",
		},
		{
			name: "rejects hybrid post-quantum curves only when TLS 1.3 is disabled",
			cfg: Config{
				TLSMaxVersion:       tls.VersionTLS12,
				TLSCurvePreferences: pqOnly,
			},
			expectErr: "require TLS 1.3",
		},
		{
			name: "accepts hybrid post-quantum curves only when TLS 1.3 is the minimum",
			cfg: Config{
				TLSMinVersion:       tls.VersionTLS13,
				TLSCurvePreferences: pqOnly,
			},
			expected: &tls.Config{MinVersion: tls.VersionTLS13, CurvePreferences: pqOnly},
		},
		{
			name: "warns about hybrid post-quantum curves only when TLS 1.2 is also allowed",
			cfg: Config{
				TLSCurvePreferences: pqOnly,
			},
			expected:    &tls.Config{MinVersion: tls.VersionTLS12, CurvePreferences: pqOnly},
			expectWarns: true,
		},
		{
			name: "accepts a TLS 1.2 capable curve next to hybrid ones with TLS 1.3 disabled",
			cfg: Config{
				TLSMaxVersion:       tls.VersionTLS12,
				TLSCurvePreferences: []tls.CurveID{tls.X25519MLKEM768, tls.CurveP256},
			},
			expected: &tls.Config{
				MinVersion:       tls.VersionTLS12,
				MaxVersion:       tls.VersionTLS12,
				CurvePreferences: []tls.CurveID{tls.X25519MLKEM768, tls.CurveP256},
			},
		},
		{
			name:        "warns about TLS 1.3 only cipher suites when TLS 1.2 is also allowed",
			cfg:         Config{TLSCipherSuites: tls13Only},
			expected:    &tls.Config{MinVersion: tls.VersionTLS12, CipherSuites: tls13Only},
			expectWarns: true,
		},
		{
			name: "rejects TLS 1.3 only cipher suites when TLS 1.3 is disabled",
			cfg: Config{
				TLSMaxVersion:   tls.VersionTLS12,
				TLSCipherSuites: tls13Only,
			},
			expectErr: "no TLS 1.2 cipher suite",
		},
		{
			name: "accepts TLS 1.3 only cipher suites when TLS 1.3 is the minimum",
			cfg: Config{
				TLSMinVersion:   tls.VersionTLS13,
				TLSCipherSuites: tls13Only,
			},
			expected: &tls.Config{MinVersion: tls.VersionTLS13, CipherSuites: tls13Only},
		},
		{
			name: "accepts a TLS 1.2 cipher suite next to TLS 1.3 ones",
			cfg: Config{
				TLSCipherSuites: []uint16{tls.TLS_AES_128_GCM_SHA256, tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256},
			},
			expected: &tls.Config{
				MinVersion:   tls.VersionTLS12,
				CipherSuites: []uint16{tls.TLS_AES_128_GCM_SHA256, tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hook := test.NewGlobal()
			defer hook.Reset()

			tlsConfig, err := newBaseTLSConfig(&tt.cfg)
			if tt.expectErr != "" {
				require.ErrorContains(t, err, tt.expectErr)
				require.Nil(t, tlsConfig)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tt.expected, tlsConfig)

			var warned bool
			for _, entry := range hook.AllEntries() {
				if entry.Level == logrus.WarnLevel {
					warned = true
				}
			}
			require.Equal(t, tt.expectWarns, warned)
		})
	}
}
