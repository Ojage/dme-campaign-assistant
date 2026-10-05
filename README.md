# Campaign Assistant — DME

Internal marketing workspace for DME. This repository is a pnpm monorepo: the React
front end lives in `apps/web`, and `apps/api` reserves the slot for the backend.

## Requirements

- Node.js >= 20.19 (developed on 24.19)
- pnpm >= 9 (developed on 9.12) — `corepack enable` if needed

## Install

```bash
pnpm install
```

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start the web app with hot reload (http://localhost:5173) |
| `pnpm dev:web` | Same as `pnpm dev` |
| `pnpm dev:api` | Start the API placeholder |
| `pnpm build` | Typecheck and produce the production bundle in `apps/web/dist` |
| `pnpm preview` | Serve the production bundle locally |
| `pnpm typecheck` | Run TypeScript across every workspace package |
| `pnpm clean` | Remove build output and caches |

The first `pnpm dev` of the session may print `http://localhost:5174` instead if
5173 is already in use.

## Sign in

Authentication is mocked in the browser, so any backend work is isolated behind a
single module. Two seeded accounts share the password `campaigns`:

- `aicha.njoya@dme.cm` — Marketing lead
- `serge.etoa@dme.cm` — Lifecycle marketer

The session is persisted in `localStorage` under `campaign-assistant:session`.
Protected routes redirect to `/login` and return you to the page you originally
requested after a successful sign-in.

## Where things live

```
apps/web/src
├── app/            Bootstrap, router, route guards, providers
├── components/     Layout (AppLayout, Sidebar, TopBar) and shared UI
├── data/mock/      Mock data layer — the swap point for the real API
├── features/       Feature slices (auth, customers, segments, campaigns)
├── hooks/          Cross-cutting hooks (theme, language)
├── i18n/           Locale resources, one namespace per feature
├── lib/            Framework-agnostic helpers
├── pages/          Route-level components
└── styles/         Tailwind layers, tokens, scrollbar styling
```

Conventions worth keeping:

- Route paths come from `RoutePath`; never hardcode a path string.
- Feature-specific UI lives under `features/<feature>/`, not in `components/`.
- Every user-facing string goes through i18n — add a namespace file per language.
- Backend calls go through the feature's `api/` module, which reads from
  `data/mock/` until the API lands.

## Swapping the mock for the real API

`src/features/auth/api/authApi.ts` is the only module that knows the session is
fake. It already reports failures as typed codes (`invalidCredentials`,
`userNotFound`, `userInactive`, `networkTimeout`), so replacing the mock bodies
with `fetch` calls needs no changes in the UI layer.