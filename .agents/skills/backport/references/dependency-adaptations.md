# Backport dependency adaptations

Treat these as investigation prompts, not a version table. Release branches evolve; verify every dependency and path from the target branch before editing.

## Repository layout

- Current branches use `web/src/features/` for feature-specific frontend code and `web/src/shared/` for cross-feature code.
- Older branches may use `web/src/` without the feature/shared split.
- OpenShift 4.16 and earlier may keep frontend files under root `src/` and may not have the Go backend.
- COO release branches normally use `web/`, but verify rather than assuming parity with an OpenShift branch.

When paths differ, map by responsibility and imports. Do not recreate removed top-level directories such as `web/src/components`, `web/src/hooks`, `web/src/store`, or `web/src/contexts` on current-layout branches.

## PatternFly

Check `@patternfly/react-core` in the target manifest. Older PatternFly versions can require:

- `DropdownToggle` instead of `MenuToggle`;
- legacy `Dropdown`/`Select` item props rather than child-based APIs;
- `onToggle` rather than `onOpenChange`;
- a different component when a newer component does not exist.

Use examples already present on the target branch as the authoritative API pattern.

A common adaptation shape is:

```tsx
// Newer PatternFly
<Dropdown
  isOpen={isOpen}
  onOpenChange={setIsOpen}
  toggle={(toggleRef) => (
    <MenuToggle ref={toggleRef} onClick={() => setIsOpen(!isOpen)}>
      {selected}
    </MenuToggle>
  )}
>
  <DropdownItem>Option</DropdownItem>
</Dropdown>

// Older PatternFly; verify the exact target API
<Dropdown
  isOpen={isOpen}
  onSelect={() => setIsOpen(false)}
  toggle={<DropdownToggle onToggle={setIsOpen}>{selected}</DropdownToggle>}
  dropdownItems={[<DropdownItem key="option">Option</DropdownItem>]}
/>
```

## React Router

Check whether the target uses `react-router-dom`, `react-router-dom-v5-compat`, or another adapter. Common adaptations include:

- `useHistory().push(...)` instead of `useNavigate()`;
- parsing `useLocation().search` instead of `useSearchParams()`;
- `Switch`/`component` routes instead of `Routes`/`element` routes.

Preserve the target branch's established routing conventions.

For example:

```ts
// Newer or v5-compat API
const navigate = useNavigate();
navigate('/alerts');
const [searchParams] = useSearchParams();

// Older React Router API
const history = useHistory();
history.push('/alerts');
const searchParams = new URLSearchParams(useLocation().search);
```

## Console SDK and plugin declarations

Inspect the target's Console SDK version, extension types, and existing configuration patches. Verify that imported APIs and extension schemas exist before retaining them.

## Validation

Select checks from the target branch itself. Typical current-layout checks include:

```bash
make lint-frontend
make test-frontend
make test-translations
make lint-backend
make test-backend
```

Run only the checks relevant to the backport and report anything unavailable on the target.
