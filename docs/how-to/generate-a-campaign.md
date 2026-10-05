# Generate a campaign

Goal: turn a segment and an objective into a draft you can review and approve.

## In the app

1. Open **Campaigns**.
2. Choose the segment to target.
3. Choose the channel (`SMS`, `email`, `push`) and the tone (`professional`,
   `friendly`, `urgent`, `promotional`).
4. Describe the objective in one sentence.
5. Select **Generate**.

The draft appears with a title, message and call to action, in state `draft`.

## From the API

```bash
curl -X POST http://localhost:4000/api/v1/campaigns/generate \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{
    "objective": "Re-engage customers who have not bought in three months",
    "segmentId": "SEGMENT_ID",
    "channel": "sms",
    "tone": "friendly"
  }'
```

## Approving it

A campaign moves through states, and only legal moves are accepted:

```bash
# draft -> ready: the draft has been reviewed
curl -X PATCH http://localhost:4000/api/v1/campaigns/CAMPAIGN_ID/status \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"status":"ready"}'

# ready -> sent: it has been dispatched
curl -X PATCH http://localhost:4000/api/v1/campaigns/CAMPAIGN_ID/status \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"status":"sent"}'
```

`ready` can go back to `draft` for another pass. Anything else — `draft → sent`,
`sent → anything` — is refused with `409 conflict`, so a campaign cannot skip
review.

## Notes

- **Generation needs the segment to exist.** An unknown `segmentId` is `404`; the
  segment name is resolved server-side, so a client cannot label a campaign with a
  name its audience does not have.
- **The tone and channel reach the prompt.** They are instructions to the model,
  not a formatting pass applied afterwards.
- **Without `ANTHROPIC_API_KEY` the API still works**, using a deterministic local
  generator. The shape of the response is identical, which keeps development and
  tests offline — but the prose is templated, not written. See
  [run without a model key](../how-to/run-without-a-model-key.md).
- **`llm_unavailable` (503)** means the provider could not be reached; the request
  is safe to retry. **`llm_error` (502)** means it answered with something
  unusable. See [the error model](../reference/errors.md).
