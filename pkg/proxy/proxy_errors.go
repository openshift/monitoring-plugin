package proxy

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"io"
	stdlog "log"
	"net"
	"strings"
	"syscall"

	"github.com/sirupsen/logrus"
)

// ErrorKind returns a classification of err that is safe to log, unlike the
// error text, which may contain URLs, addresses or file paths.
func ErrorKind(err error) string {
	var (
		certVerifyErr  *tls.CertificateVerificationError
		unknownAuthErr x509.UnknownAuthorityError
		hostnameErr    x509.HostnameError
		certInvalidErr x509.CertificateInvalidError
		recordErr      tls.RecordHeaderError
		alertErr       tls.AlertError
		dnsErr         *net.DNSError
		netErr         net.Error
		opErr          *net.OpError
	)

	switch {
	case err == nil:
		return ""
	case errors.Is(err, context.Canceled):
		return "canceled"
	case errors.Is(err, context.DeadlineExceeded):
		return "timeout"
	case errors.As(err, &certVerifyErr),
		errors.As(err, &unknownAuthErr),
		errors.As(err, &hostnameErr),
		errors.As(err, &certInvalidErr),
		errors.As(err, &recordErr),
		errors.As(err, &alertErr):
		return "tls"
	case errors.As(err, &dnsErr):
		return "dns"
	case errors.As(err, &netErr) && netErr.Timeout():
		return "timeout"
	case errors.Is(err, syscall.ECONNREFUSED):
		return "connection_refused"
	case errors.Is(err, syscall.ECONNRESET), errors.Is(err, io.ErrUnexpectedEOF):
		return "connection_reset"
	case errors.As(err, &opErr):
		return "network"
	default:
		return "other"
	}
}

var reverseProxyLogMessages = map[string]string{
	"httputil: ReverseProxy read error during body copy": "read error while streaming upstream response body",
}

// NewRedactedErrorLog returns a logger for httputil.ReverseProxy.ErrorLog that
// replaces the message, which may contain the upstream address, with a fixed one.
func NewRedactedErrorLog(entry *logrus.Entry) *stdlog.Logger {
	return stdlog.New(redactedLogWriter{entry: entry}, "", 0)
}

type redactedLogWriter struct {
	entry *logrus.Entry
}

func (w redactedLogWriter) Write(p []byte) (int, error) {
	msg := "reverse proxy error"
	line := string(p)
	for prefix, redacted := range reverseProxyLogMessages {
		if strings.HasPrefix(line, prefix) {
			msg = redacted
			break
		}
	}
	w.entry.Error(msg)
	return len(p), nil
}
