# The generative pipeline

What happens between "generate a campaign" and the words on screen, and why each
piece sits where it does.

## The path

```
UI  →  API controller  →  use case  →  LlmPort  →  adapter  →  provider
                             ↑                          ↓
                      ports: segments, campaigns  Scripted | Anthropic | OpenCode
```

A use case assembles the prompt from data it already owns — the objective, the
segment name, the audience size, the channel, the tone — and hands the assembled
request to a port. It never learns which provider is behind it.

## Three adapters, one port

**`AnthropicModel`** calls Anthropic on its native `/messages` route. Selected
when `ANTHROPIC_API_KEY` is set.

**`OpenCodeModel`** calls an OpenAI-compatible `/chat/completions` route — OpenCode
Zen by default, and any compatible gateway through `OPENCODE_BASE_URL`. Selected
when `OPENCODE_API_KEY` is set and Anthropic is not. Its streaming is framed as SSE
and its structured output is re-validated against the zod schema after the call,
because the gateway is asked to constrain the shape but is not trusted to have done
so.

**`ScriptedModel`** builds a deterministic reply locally, with no network and no
cost. It is selected when no key is configured, and the boot log says so.

`MODEL_PROVIDER` chooses explicitly, or `auto` walks the three in that order.
Naming a provider whose key is missing resolves to `scripted` and logs the
mismatch, rather than binding an adapter that would fail on every call.

The local generator is not a mock. It implements the same port, returns the same
shapes, and streams chat replies frame by frame, so the whole path — controller,
use case, validation, SSE framing, browser rendering — is exercised identically
offline. See [run without a model key](../how-to/run-without-a-model-key.md).

## Why the model output is validated

A language model returns text, and text is not a schema. The adapter parses the
reply against the campaign schema before it becomes a campaign.

If the parse fails, the adapter repairs what it can — filling a missing field from
the objective, for instance — and only then gives up. A malformed reply surfaces as
`llm_error`, never as a campaign with an empty title that reaches a user.

## Why the segment name is resolved server-side

The client sends a `segmentId`, never a name. The use case loads the segment and
takes the name from the database. A client therefore cannot label a campaign with
an audience it does not have, and a segment rename cannot leave history showing a
name that no longer exists.

## Why campaign status is not the model's job

The model drafts. It cannot approve or send. Status moves are a separate endpoint
with rules enforced in the domain: `draft → ready → sent`, plus `ready → draft`
for another pass. Anything else is `conflict`.

This keeps a probabilistic component away from an irreversible one. The worst a
bad generation can do is produce a draft a person has not approved.

## Streaming

For chat, the same use case can be read incrementally. The controller writes
server-sent events: `start`, then `delta` per chunk, then a terminal `done` or
`error`. `done` carries the stored message, so a client that only appended deltas
ends up consistent with the database even if a frame was lost.

The API configures body parsing explicitly so this route is not buffered, and
`text/event-stream` must survive any proxy in front of it.

## When a provider misbehaves

A provider call is the slowest and least predictable thing in the request, so it is
bounded and repeated rather than left to hang.

Each attempt has a deadline (`ANTHROPIC_TIMEOUT_MS`, `OPENCODE_TIMEOUT_MS`). Only a
transient failure is retried — a dropped connection, `429`, `5xx`, or a timeout —
because repeating a rejected key or a malformed request cannot make it succeed. The
wait before each retry grows exponentially and is randomised across `0`–`delay`,
which stops every request that failed at the same moment from returning at the same
moment and making the outage worse.

The retry repeats the *same* provider. There is no fallback to another provider or to
the local generator: a caller asking for a campaign would otherwise get back copy
from a different model than the one configured, with nothing marking the difference.
Once the attempts are exhausted the caller gets `503` and `llm_unavailable`.

## Retrying the request, not just the call

A provider retry covers the model call. It does not cover the response on its way
back — a connection dropped after the model answered would leave the campaign created
but the client seeing a failure, which invites the client to ask again and create a
second one.

So `POST /campaigns/generate` accepts an `Idempotency-Key` header. The first response
is recorded against that key; a repeat of the same request returns it again with
`Idempotency-Replayed: true` instead of generating a second campaign. Reusing a key
for a *different* body is refused with `conflict`, and a failure is never recorded,
so a key stays usable for retrying. The browser mints one key per submission and
reuses it for that submission's retries.

Records are kept per authenticated caller, so one member cannot replay another's key.
They are currently never pruned.

## Tuning

- `ANTHROPIC_MAX_TOKENS` bounds a single generation. A campaign is short by
  design; a long reply usually means a prompt problem, not a limit problem.
- The tone and channel reach the prompt as instructions. They are not a formatting
  pass applied afterwards, because a formatting pass cannot fix a draft whose
  *intent* does not match the tone requested.
