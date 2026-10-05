# Run without a model key

Goal: develop, test and demo with no `ANTHROPIC_API_KEY` set.

## What happens

The API checks for the key at boot. Without one it selects a deterministic local
generator instead of the Anthropic adapter and logs a warning. Every endpoint
behaves the same way; only the wording of generated content differs.

## What you get

- **Campaigns**: a draft assembled from your objective, channel and tone. Same
  fields, valid schema, plausible structure, templated prose.
- **Chat**: a reply drawn from a fixed set of answers, streamed frame by frame so
  the streaming path is exercised identically.

## Setting a key later

```bash
# apps/api/.env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5
ANTHROPIC_MAX_TOKENS=1024
```

Restart the API. The warning disappears and the same endpoints call the model. No
code change, no rebuild.

## Notes

- **Tests should not depend on the real model.** Non-determinism and a network
  round trip make tests slow and flaky; the local generator is what keeps the
  suite offline. See [architecture](../explanation/architecture.md).
- **The fallback is not a mock.** It implements the same port as the real adapter,
  so use cases, controllers and the browser see identical responses — a test that
  passes offline exercises the production path.
