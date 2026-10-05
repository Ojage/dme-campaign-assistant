# Client state

Why the web app has two state libraries, and what each one is not allowed to hold.

## The split

| Concern | Owner | Example |
| --- | --- | --- |
| Session and tokens | Zustand, persisted | Signed-in user, access and refresh tokens |
| Anything the server returned | TanStack Query | Customers, segments, campaigns, KPIs |
| An unsaved form draft | Local component state | The campaign composer, the segment builder |

A test of the rule: if a value can be fetched again, it belongs in a query. If it
cannot — because the server does not know it — it is either Zustand or local.

## Why Zustand for the session

The HTTP client needs the access token on every call, including calls made outside
a React render. Context would force that token through a provider and a hook on
every path that needs it; a store is a plain read.

```ts
const token = useAuthStore.getState().accessToken
```

That is the whole argument. No `useToken` hook, no provider in the tree, and the
client is usable from a plain function or a test.

### Persistence

The store is persisted to `localStorage` under one key, and only the user and the
two tokens are written — never a password. `partialize` makes that explicit rather
than a convention.

On rehydration the stored user decides the status: `authenticated` or `anonymous`,
never a stale `loading`. The router waits for a `hydrated` flag before deciding, so
refreshing an authenticated page does not flash the sign-in screen.

## Why TanStack Query for server data

Caching, deduplication, retry and invalidation are the problem, and this is a
solved problem. The concrete wins here:

- **Five screens read customers.** With a query, the second screen to mount finds
  the first one's request in flight.
- **A write invalidates a key.** Importing customers refreshes the table, the KPIs
  and the dashboard because all three read the same keys.
- **Loading, error and empty are distinct.** A component can show a skeleton, an
  error with a retry, or an empty state, without inventing its own flags.

### The consequence worth stating

There is no event bus in this application. The old cross-component refresh events
are gone; a mutation invalidating a query key is the whole mechanism. That removes
a class of bug where one screen updates and another silently does not.

## Why form drafts are local

The campaign composer and the segment builder hold unsaved input. Nothing else
reads it, and it is invalid until submitted. Putting it in a query cache would mean
caching every keystroke.

The one exception is the segment builder's audience preview: it is a request, so it
is debounced and called against the API — but the draft conditions stay local, and
nothing is saved until the user saves it.

## Rules that keep this honest

- A component does not call `apiClient` directly; it calls a feature API function.
- A feature API function is a thin wrapper — it converts a form's values into a
  contract payload and nothing else.
- Server state is never copied into Zustand. If two places need it, they both read
  the query.
