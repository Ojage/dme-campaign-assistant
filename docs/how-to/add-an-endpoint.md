# Add an endpoint

Goal: add one operation to the API and use it from the web app, without any
definition being written twice.

The contract package is the source of truth. Everything else follows from it.

## 1. Describe the operation

In `packages/contracts/src/domains/<feature>/contracts.ts`, define the request and
response schemas with zod. Write the shape the caller should send and the shape it
should read back — they are often different.

```ts
export const campaignNoteSchema = z.object({
  id: idSchema,
  campaignId: idSchema,
  note: z.string().min(1).max(500),
  createdAt: isoDateTimeSchema,
})
```

## 2. Register it

In `packages/contracts/src/http/api.ts`, add it to `operations` with its metadata.
The `satisfies Record<string, Operation>` check is what keeps the entry honest:

```ts
'campaigns.addNote': {
  method: 'POST',
  params: z.object({ id: z.string().min(1) }),
  path: '/campaigns/:id/notes',
  body: z.object({ note: z.string().min(1).max(500) }),
  response: campaignNoteSchema,
  auth: true,
  summary: 'Attach a review note to a campaign',
  description: 'Notes are internal: they are visible to the team, never to a customer.',
  tags: ['Campaigns'],
  errors: ['not_found', 'validation_failed'],
},
```

The typed client method, the request and response types, and the OpenAPI entry now
all exist. `summary`, `description` and `errors` are not decoration: the spec is
generated from them, and a missing error code shows up as an undocumented
failure in the published reference.

## 3. Implement it

Follow the shape of an existing feature:

```
src/modules/<feature>/
  domain/            entities and rules, no framework types
  application/       use cases, depending only on ports
  infrastructure/    TypeORM repository, external adapters
  interface/http/    controller, validation pipe input
```

Add a use case that depends on a port, then implement the port. A controller only
translates HTTP: validate, call the use case, map the result to a status code.

## 4. Expose it

The controller's route must match the registered path. It is validated at boot by
the same prefix, version and path the client will use, so a mismatch shows up as a
route that answers 404 rather than as a type error.

## 5. Confirm the contract holds

```bash
pnpm --filter @dme/api typecheck
pnpm --filter @dme/contracts test
pnpm openapi:write
```

The specification test fails if a registered operation is missing from the
document, undocumented for a declared error code, or references a schema that does
not exist. Read the diff in `docs/reference/openapi.json` — that is the reviewable
record of what you changed.

## 6. Call it from the web app

Add a thin function in the feature's `api/` folder and wrap it in a TanStack Query
hook. Both the request and response types come from the registry:

```ts
export function addCampaignNote(id: string, note: string) {
  return apiClient.call('campaigns.addNote', { params: { id }, body: { note } })
}
```

There is no interface to update: if the contract changes, this file stops
compiling.

## Notes

- **Do not define a TypeScript interface for a response.** The registry entry is
  the type. A hand-written interface is a second source of truth that will drift.
- **Put behaviour in use cases, not controllers.** A controller that contains a
  condition on business data cannot be reused by the seed script or a future job.
