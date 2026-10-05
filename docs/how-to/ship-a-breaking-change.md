# Ship a breaking change

Goal: change a request or response shape without breaking a client that has not
been updated yet.

## Know whether you are breaking

**Not breaking** — ship inside `v1`:

- a new endpoint
- a new optional request field
- a new response field
- a new error code on an endpoint that already fails
- a longer description

**Breaking** — needs `v2`:

- removing or renaming a field
- making an optional field required
- narrowing a type, range or enum
- changing a status code
- changing a default
- changing the meaning of an existing field

A new enum *value* is additive in spirit but not in fact: a client that rejects
unknown values will break. Treat adding an enum value as breaking if the contract
documents the enum as closed.

## Ship it

### 1. Change the contract

Bump the version constant and give the new operation its own entry. Keep the old
one while the old version is supported:

```ts
// packages/contracts/src/http/version.ts
export const API_VERSION = 'v2'
```

A second package, or a second registry, is the honest way to hold two versions.
While both are supported, publish two documents so each describes one version.

### 2. Mark the old operation deprecated

```ts
'customers.list': {
  // ...
  deprecated: true,
  description: 'Superseded by customers.search. Removed after 2026-12-31.',
}
```

The generated document carries `deprecated: true`, so the reference shows it, and
`Deprecation`/`Sunset` headers are emitted for it.

### 3. Publish the sunset date

The old version keeps answering until its sunset date, then is removed along with
its schemas. Removing it is a deliberate act, not a side effect of the next change.

## Notes

- **A version bump is not a big-bang cutover.** Both versions are served at once;
  clients migrate on their own schedule.
- **Do not version by header or media type here.** A URL a client can read, log
  and bookmark is worth more than the elegance of the alternative. The reasoning
  is in [versioning](../explanation/api-versioning.md).
- **The generated spec is your migration guide.** Its diff shows exactly which
  fields appeared, vanished or changed type.
