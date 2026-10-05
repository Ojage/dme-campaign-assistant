# Sessions and authentication

Why there are two tokens, why the refresh token is stored, and what happens when
one leaks.

## The shape of a session

Signing in returns three things: the user, a short-lived **access token** and a
longer-lived **refresh token**.

- The **access token** is a JWT, signed with `JWT_ACCESS_SECRET`, valid for 15
  minutes. Every request carries it; the server verifies the signature and nothing
  else, so no database round trip sits in front of each call.
- The **refresh token** is opaque, stored in the database with the user's sessions,
  and valid for 7 days. It exists only to mint new access tokens.

Both tokens are signed with *different* secrets, so a leaked access-token secret
cannot be used to mint refresh tokens.

## Why the refresh token is stored

A JWT alone cannot be withdrawn: it is valid until it expires, and nothing on the
server knows it was revoked. Storing the refresh token makes withdrawal possible —
which is what makes sign-out real.

The refresh flow therefore costs a database lookup, once every 15 minutes per
session, not once per request. That is the trade: a cheap hot path and a
revocable cold one.

## Rotation

Every refresh rotates the pair:

1. The presented refresh token is looked up and **revoked**.
2. A new pair is issued.

A token can therefore be exchanged exactly once. If a stolen token is replayed
after the legitimate client has already refreshed it, the replay is rejected as
`session_expired` — and the anomaly is visible.

This is the standard mitigation for a stolen refresh token: the attacker and the
owner race, and the loser gets an error rather than a silent second session.

## Sign-out

`auth.signOut` revokes the refresh token presented in the body. It is idempotent,
because a user who clicks twice, or whose token expired a moment earlier, should
not see an error.

The access token remains valid until it expires — up to 15 minutes. Revoking it
immediately would mean a database lookup on every request, which is the cost the
two-token design exists to avoid. A stolen access token is therefore usable for
the remainder of its lifetime; a stolen refresh token is usable at most once.

## Where the tokens live in the browser

Both tokens are held in a persisted Zustand store under one key, and sent as an
`Authorization` header. No cookies, so no CSRF surface and nothing for a sibling
route to read.

The trade is explicit: `localStorage` is readable by any script that runs on the
origin. This is acceptable here because there is no payment data and the
refresh-token rotation already limits the blast radius. An application handling
higher-value credentials should move refresh tokens to an `HttpOnly`, `Secure`,
`SameSite=Strict` cookie and keep only the access token in memory.

## Refresh on the client

The HTTP client refreshes once and replays the original request:

- A `401` triggers a refresh.
- Concurrent `401`s share **one** refresh, so a screen firing five queries does not
  fire five refreshes.
- If the refresh fails, the session is cleared and the router sends the user to sign
  in, remembering where they were.

## Public endpoints

Everything requires a token except `auth.signIn` and `auth.refresh`. The guard is
global and opt-out (`@Public()`), so a new endpoint is protected unless someone
deliberately opens it — the safe default.
