package k8s

import "context"

type bearerTokenKey struct{}

// WithBearerToken stores a bearer token in the context for downstream requests.
func WithBearerToken(ctx context.Context, token string) context.Context {
	if token == "" {
		return ctx
	}
	return context.WithValue(ctx, bearerTokenKey{}, token)
}

// BearerTokenFromContext retrieves the bearer token stored in the context.
func BearerTokenFromContext(ctx context.Context) string {
	if token, ok := ctx.Value(bearerTokenKey{}).(string); ok {
		return token
	}
	return ""
}
