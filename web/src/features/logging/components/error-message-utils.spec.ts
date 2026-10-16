import {
  getForbiddenKind,
  queryHasNamespaceFilter,
} from '@/features/logging/components/error-message-utils';

describe('forbidden classification for the admin logs view (OU-578)', () => {
  it('classifies a 403 with no namespace selected as a friendly select-namespace prompt', () => {
    // Admin without cluster-wide access hits the unscoped query; not a genuine
    // failure yet, they just need to scope to a namespace they can read.
    expect(getForbiddenKind(403, false)).toBe('no-namespace');
  });

  it('classifies a 403 with a namespace selected as a genuine forbidden error', () => {
    expect(getForbiddenKind(403, true)).toBe('namespace-selected');
  });

  it('keeps the real forbidden error when the namespace scope is unknown', () => {
    expect(getForbiddenKind(403, undefined)).toBe('namespace-selected');
  });

  it('is not a forbidden state for non-403 responses', () => {
    expect(getForbiddenKind(502, false)).toBe('none');
    expect(getForbiddenKind(200, true)).toBe('none');
    expect(getForbiddenKind(undefined, false)).toBe('none');
  });

  it('classifies an audit-tenant 403 as an audit forbidden error', () => {
    // Audit logs have no namespace, so neither the select-namespace prompt nor the
    // application RoleBinding guidance applies.
    expect(getForbiddenKind(403, true, 'audit')).toBe('audit');
  });

  it('does not classify a non-403 audit response as forbidden', () => {
    expect(getForbiddenKind(200, true, 'audit')).toBe('none');
  });

  it('keeps namespace-based classification for non-audit tenants', () => {
    expect(getForbiddenKind(403, false, 'application')).toBe('no-namespace');
    expect(getForbiddenKind(403, true, 'application')).toBe('namespace-selected');
  });
});

describe('queryHasNamespaceFilter (executed-query namespace scope for OU-578)', () => {
  // Detection is schema-agnostic and value-agnostic: any namespace scope counts,
  // even the other schema's label or a namespace that does not exist.
  it('detects the viaq namespace label', () => {
    expect(
      queryHasNamespaceFilter('{ log_type="application", kubernetes_namespace_name="my-test-1" }'),
    ).toBe(true);
  });

  it('detects the otel namespace label', () => {
    expect(
      queryHasNamespaceFilter(
        '{ openshift_log_type="application", k8s_namespace_name="my-test-1" }',
      ),
    ).toBe(true);
  });

  it('detects a namespace label regardless of the selected schema', () => {
    // otel label while schema is viaq (or vice versa) — previously missed.
    expect(queryHasNamespaceFilter('{ k8s_namespace_name="ghost" }')).toBe(true);
    expect(queryHasNamespaceFilter('{ kubernetes_namespace_name="ghost" }')).toBe(true);
  });

  it('detects a namespace scoped to a non-existent namespace', () => {
    expect(queryHasNamespaceFilter('{ kubernetes_namespace_name="does-not-exist" }')).toBe(true);
  });

  it('ignores a namespace expressed only as a pipeline label filter', () => {
    expect(
      queryHasNamespaceFilter(
        '{ log_type="application" } | json | kubernetes_namespace_name="ghost"',
      ),
    ).toBe(false);
  });

  it('ignores a namespace exclusion matcher (!= admits other namespaces)', () => {
    expect(
      queryHasNamespaceFilter('{ log_type="application", kubernetes_namespace_name!="blocked" }'),
    ).toBe(false);
    expect(
      queryHasNamespaceFilter('{ log_type="application", kubernetes_namespace_name!~"blocked.*" }'),
    ).toBe(false);
  });

  it('detects a namespace regex matcher that constrains the query', () => {
    expect(queryHasNamespaceFilter('{ kubernetes_namespace_name=~"my-.*" }')).toBe(true);
  });

  it('ignores a catch-all namespace regex (=~ that matches every namespace)', () => {
    // .* / .+ (with or without anchors) select all namespaces, so the query isn't scoped.
    expect(queryHasNamespaceFilter('{ kubernetes_namespace_name=~".*" }')).toBe(false);
    expect(queryHasNamespaceFilter('{ kubernetes_namespace_name=~".+" }')).toBe(false);
    expect(queryHasNamespaceFilter('{ kubernetes_namespace_name=~"^.*$" }')).toBe(false);
  });

  it('returns false for an unscoped query (no namespace label)', () => {
    expect(queryHasNamespaceFilter('{ log_type="application" }')).toBe(false);
  });

  it('detects a compound query where every selector is namespace-scoped', () => {
    expect(
      queryHasNamespaceFilter(
        'sum(rate({ kubernetes_namespace_name="a" }[5m])) or sum(rate({ kubernetes_namespace_name="b" }[5m]))',
      ),
    ).toBe(true);
  });

  it('returns false for a compound query where one selector is unscoped', () => {
    expect(
      queryHasNamespaceFilter(
        'sum(rate({ kubernetes_namespace_name="a" }[5m])) or sum(rate({ log_type="application" }[5m]))',
      ),
    ).toBe(false);
  });

  it('returns false when the namespace label has an empty value', () => {
    expect(
      queryHasNamespaceFilter('{ log_type="application", kubernetes_namespace_name="" }'),
    ).toBe(false);
  });

  it('detects a backtick raw-string namespace value', () => {
    expect(queryHasNamespaceFilter('{ kubernetes_namespace_name=`my-test-1` }')).toBe(true);
  });

  it('ignores a catch-all namespace regex written as a backtick raw string', () => {
    expect(queryHasNamespaceFilter('{ kubernetes_namespace_name=~`.*` }')).toBe(false);
  });

  it('returns false when a backtick raw-string namespace value is empty', () => {
    expect(
      queryHasNamespaceFilter('{ log_type="application", kubernetes_namespace_name=`` }'),
    ).toBe(false);
  });

  it('returns false for an empty query', () => {
    expect(queryHasNamespaceFilter('')).toBe(false);
  });

  it('treats an audit-tenant query as scoped so its 403 is a generic forbidden error', () => {
    // Audit logs have no namespace label so the query must be reported as scoped.
    expect(queryHasNamespaceFilter('{ log_type="audit" }', 'audit')).toBe(true);
    expect(queryHasNamespaceFilter('', 'audit')).toBe(true);
  });

  it('still detects scope by query for non-audit tenants', () => {
    expect(queryHasNamespaceFilter('{ kubernetes_namespace_name="a" }', 'application')).toBe(true);
    expect(queryHasNamespaceFilter('{ log_type="application" }', 'application')).toBe(false);
  });
});
