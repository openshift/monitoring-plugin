package monitoring

import (
	"context"
	"crypto/x509"
	"errors"
	"fmt"
	"io"
	"net"
	"net/url"
	"os"
	"syscall"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestErrorKind(t *testing.T) {
	wrap := func(err error) error {
		return &url.Error{Op: "Get", URL: "https://upstream.example:9095", Err: err}
	}
	opErr := func(err error) error {
		return &net.OpError{Op: "dial", Net: "tcp", Err: &os.SyscallError{Syscall: "connect", Err: err}}
	}

	for name, tc := range map[string]struct {
		err  error
		want string
	}{
		"nil":                {err: nil, want: ""},
		"canceled":           {err: wrap(context.Canceled), want: "canceled"},
		"deadline":           {err: wrap(context.DeadlineExceeded), want: "timeout"},
		"unknown authority":  {err: wrap(x509.UnknownAuthorityError{}), want: "tls"},
		"hostname mismatch":  {err: wrap(x509.HostnameError{Host: "upstream.example"}), want: "tls"},
		"dns":                {err: wrap(&net.DNSError{Name: "upstream.example", Err: "no such host"}), want: "dns"},
		"connection refused": {err: wrap(opErr(syscall.ECONNREFUSED)), want: "connection_refused"},
		"connection reset":   {err: wrap(opErr(syscall.ECONNRESET)), want: "connection_reset"},
		"unexpected eof":     {err: wrap(io.ErrUnexpectedEOF), want: "connection_reset"},
		"other network":      {err: wrap(opErr(syscall.EHOSTUNREACH)), want: "network"},
		"other":              {err: fmt.Errorf("upstream.example: %w", errors.New("boom")), want: "other"},
	} {
		t.Run(name, func(t *testing.T) {
			require.Equal(t, tc.want, ErrorKind(tc.err))
		})
	}
}
