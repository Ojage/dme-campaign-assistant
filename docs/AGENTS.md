# Campaign Assistant documentation

This folder is the single source of truth for the public documentation site
(published with [Mintlify](https://mintlify.com)). It follows
[Diátaxis](https://diataxis.fr): four kinds of document, kept in separate
directories, answering four different questions.

| Directory | Kind | Question it answers |
| --- | --- | --- |
| `tutorials/` | Tutorial | Show me how to use this, step by step. |
| `how-to/` | How-to guide | How do I do this specific thing? |
| `reference/` | Reference | What exactly does this accept and return? |
| `explanation/` | Explanation | Why is it built this way? |

## Writing rules

- Place a page in the directory that matches its question. If you are unsure,
  read the Diátaxis page for that type before writing.
- Pages are MDX with YAML frontmatter (`title`, `description`, optional `icon`).
- Prefer Mintlify components for structure: `<Steps>` for a sequence,
  `<Info>/<Tip>/<Note>/<Warn>` for asides, `<Card>`/`<Cards>` for entry points.
- Link between pages with extensionless relative paths, e.g. `../explanation/contracts`.
- The API reference is **generated from `reference/openapi.json`** by Mintlify —
  never hand-write endpoint pages. Keep that file in sync by running
  `pnpm openapi:write`; CI fails if it drifts from the contracts package.
- Terminology: "customers" not "users"; "segment" not "audience definition";
  a "campaign" moves through `draft`, `ready`, `sent`.
- Use active voice and second person ("you"). Keep sentences concise.

## Previewing locally

```bash
npx mint@latest dev
```

Preview renders at `http://localhost:3000`. Commits to the default branch
redeploy the site; pull requests render preview deployments.

## Don't

- Do not edit `api-reference/` — generated pages. Change the OpenAPI file or the
  contracts package instead.
- Do not duplicate facts that already live in `reference/configuration.mdx` or
  `explanation/architecture.mdx`; link to them.