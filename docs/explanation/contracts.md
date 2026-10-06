# The shared contract

Why one package describes the transport, and what it buys both sides.

## What is in it

`packages/contracts` holds the schemas and the typed client:

- zod schemas per feature: request bodies, responses, query strings, path params
- a **registry** mapping an operation name to method, path, schemas and metadata
- type helpers derived from that registry — there is no hand-written interface
- `HttpClient`, which calls operations by name, validates every response, and
  refreshes an expired token
- the SSE reader, which yields validated stream events
- the version constant, and the OpenAPI generator built from the registry

## One definition, three consumers

The same schema is used to:

1. **validate requests** in the API (a validation pipe),
2. **validate responses** in the browser (on arrival),
3. **generate the OpenAPI specification** published as the reference.

A shape is therefore declared once. The failure this prevents is not exotic: a
backend that adds a required field, a frontend that has not been updated, and a
deploy where sign-in silently stops working.

## Why zod rather than generated types

The type could be generated from the schema, but then it would be checked at
compile time only — and the interesting failures happen when the bytes arrive. A
schema that validates at runtime can be the single definition; the types are
inferred from it, not maintained beside it.

This is what makes the strictness rule affordable: application code may not use
`any`, precisely because the boundary is already typed and checked.

## Why validation happens on the client too

An API that is correct is still not always reachable: a proxy can rewrite a body,
a cache can serve a stale response, two deployments can drift. Validating on arrival
turns those into an immediate, named failure at the boundary instead of
`undefined` surfacing three layers into a component.

The cost is one parse per response, which is not measurable next to the network
round trip it follows.

## The registry is the API's inventory

`operations` lists every endpoint. Adding an entry there gives you, immediately:

- a typed client method
- the request and response types
- an entry in the OpenAPI specification
- a place to declare which error codes it can produce

The specification test asserts that the document and the registry agree, and that
every declared error code is documented — so an endpoint cannot be published with
an undocumented failure mode.

## Versioning the contract

`version.ts` holds the version. Paths in the registry are version-relative and the
client prefixes them, so a version bump is a one-line change that moves the client,
the server and the document together. See [versioning](api-versioning.md).

## What the contract deliberately does not contain

- Business rules. "A campaign cannot go from draft to sent" lives in the domain,
  not in a schema.
- Persistence. A repository may store an id the contract never sees.
- Anything framework-specific. The API's controllers and the browser's components
  both sit *outside* this package, which is why it can be shared at all.
