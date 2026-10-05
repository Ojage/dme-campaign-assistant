# Errors

Every failure the API can produce, and how to tell them apart.

## The document

Failures are [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) problem documents,
served as `application/problem+json`:

```json
{
  "type": "https://api.campaigns.example/problems/validation_failed",
  "title": "Validation failed",
  "status": 400,
  "code": "validation_failed",
  "detail": "email must be a valid address",
  "errors": [{ "field": "email", "message": "must be a valid address" }],
  "traceId": "0f1c…"
}
```

`code` is the stable field: match on it, never on `title` or `detail`, which are
written for humans and may be reworded. `traceId` matches the server log line for
the same request, which is what makes a user-reported failure findable.

## Codes

| Code | Status | Means | Client should |
| --- | --- | --- | --- |
| `validation_failed` | 400 | The request does not satisfy the contract. `errors` names each field. | Show the messages next to the inputs. Do not retry unchanged. |
| `invalid_credentials` | 401 | Email or password is wrong. | Say the credentials were refused; do not reveal which. |
| `unauthenticated` | 401 | No token, or it is not a valid token. | Send the user to sign in. |
| `session_expired` | 401 | The refresh token was already used, revoked or expired. | Clear the session and sign in again. |
| `forbidden` | 403 | Authenticated, but not allowed. | Show an explanation; retrying will not help. |
| `not_found` | 404 | No such resource, or none visible to this user. | Treat as empty. |
| `conflict` | 409 | The request contradicts current state: duplicate email, illegal campaign transition. | Explain the conflict and let the user decide. |
| `rate_limited` | 429 | Too many requests. | Back off, honour `Retry-After`. |
| `llm_unavailable` | 503 | The model provider could not be reached. | Retry; offer the local generator. |
| `llm_error` | 502 | The provider answered with something unusable. | Retry once, then surface a failure. |
| `internal_error` | 500 | A bug. | Report `traceId`. |

## Unknown failures

A response that is not a problem document — a proxy's HTML 502, for instance —
surfaces as a transport error rather than an `ApiError`. Treat it as retryable and
do not attempt to parse it.

## Transport errors are not HTTP errors

A request that never completes raises `network_error`, which is deliberately not an
error code: it describes the call, not the server's answer, and it has no status.
