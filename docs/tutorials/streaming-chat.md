# Streaming a chat reply

This tutorial is for readers(ofcourse it is me too) who want to understand server-sent events by writing
one. It assumes you have finished [your first campaign](first-campaign.md), so
the API is running and you are signed in.

By the end you will have watched tokens arrive one at a time and will know which
part of the system moves the bytes.

## What you will build

A small script that sends a message and prints the reply as it is produced,
rather than waiting for it to finish.

## Step 1: Get a token

The API answers `POST /api/v1/auth/sign-in` with an access token:

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/sign-in \
  -H 'content-type: application/json' \
  -d '{"email":"aicha.njoya@dme.cm","password":"campaigns"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["accessToken"])')
```

Every endpoint except sign-in and refresh requires it. Notice the `/v1` segment:
that is the API version, and it is part of the path on purpose. See
[versioning](../explanation/api-versioning.md).

## Step 2: Start a thread

```bash
THREAD=$(curl -s -X POST http://localhost:4000/api/v1/chat/threads \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"title":"Streaming from the terminal"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
```

A thread is where messages live. It starts empty; its title comes from the first
message you send.

## Step 3: Stream the reply

```bash
curl -N -X POST "http://localhost:4000/api/v1/chat/threads/$THREAD/messages/stream" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"content":"Give me one sentence about re-engaging inactive customers."}'
```

`curl -N` disables buffering so frames appear as they arrive. You will see
frames shaped like this:

```
data: {"type":"start","threadId":"...","userMessageId":"..."}
data: {"type":"delta","text":"Re-engaging"}
data: {"type":"delta","text":" inactive"}
data: {"type":"done","assistantMessage":{"id":"...","role":"assistant","content":"..."}}
```

Notice what is *not* there: no token block, no polling. The connection stays open
for the whole reply.

## Step 4: Notice the shape of a frame

Four event types, and the last one always terminates the exchange:

- `start` — your message was stored; `userMessageId` is its id.
- `delta` — a fragment in `text` to append. Never assume a delta is a whole word.
- `done` — `assistantMessage` is the complete stored message, so a client can
  reconcile what it appended with what was actually written.
- `error` — generation failed; the partial text is discarded.

The exact shapes are `chatStreamEventSchema` in
`packages/contracts/src/domains/chat/contracts.ts`, and every frame is validated
against it before your code sees it.

Because `done` carries the stored message, a client that only appended deltas
still ends up consistent with the database. That is deliberate.

## What you have learned

Streaming is a transport detail, not a different operation: the same use case
answers both `POST .../messages` (one complete reply) and
`POST .../messages/stream` (frames). See
[stream a reply](../how-to/stream-a-reply.md) for the browser-side recipe, and
[the generative pipeline](../explanation/generative-pipeline.md) for how the model
is actually called.
