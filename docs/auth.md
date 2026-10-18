# Authentication and private notes

For MANEF production, follow [WorkOS sign-in](workos-login.md). Google OAuth credentials
stay in the MANEF WorkOS integration; the app uses its WorkOS credentials. The following
sections document the retained direct-Google compatibility adapter, not the MANEF
production rollout.

Local backend regression coverage also verifies two distinct WorkOS subjects and
the same subject under different issuers: sharing an email never grants note access.
These test identities are synthetic; they do not replace deployed login and private
CRUD acceptance. The production callback findings in [WorkOS sign-in](workos-login.md)
are dated evidence, not a claim about the current provider state. The Workers pilot
has separate single-account acceptance; deployed two-account isolation remains open.

## Direct Google compatibility adapter

The starter includes a Google OpenID Connect flow and a small private Convex notes
feature. `AUTH_ENABLED=false` is the default: a fresh clone needs no Google credentials.
The application has one user identity per Google subject; it does not implement teams,
roles, account linking, invitations or an account-deletion workflow.

## Enable a project

1. Create a Google OAuth **web application** client for your own project. Configure its
   consent screen, audience and test users. Register the exact redirect URI
   `https://your-domain.example/auth/callback`; local development may use
   `http://localhost:5173/auth/callback`. This template cannot provision your consent
   screen, verified domain or credentials.
2. Set these values on the **SvelteKit server**. Keep all `AUTH_*` values private:

   | Variable              | Value                                        |
   | --------------------- | -------------------------------------------- |
   | `AUTH_ENABLED`        | `true`                                       |
   | `AUTH_PROVIDER`       | `google` (default)                           |
   | `AUTH_CLIENT_ID`      | Your Google web client ID                    |
   | `AUTH_CLIENT_SECRET`  | Its client secret                            |
   | `AUTH_SESSION_SECRET` | 32 random bytes encoded as base64url         |
   | `PUBLIC_SITE_URL`     | The exact application origin, without a path |
   | `PUBLIC_CONVEX_URL`   | Your own Convex deployment URL               |

   Generate a session key in a private terminal with:

   ```sh
   bun -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

3. Set the same `AUTH_CLIENT_ID` on the **Convex deployment**, then deploy its functions.
   Convex needs the public client identifier to verify the token's audience; it does
   **not** need the Google client secret or application session key. Without this ID,
   `src/convex/auth.config.ts` exports an empty provider list. Removing the frontend
   flag alone does not remove a provider already configured in Convex.
   Convex throws on an absent variable in auth configuration; the config catches only
   that specific missing-ID error. Other configuration errors still fail deployment.
4. Open `/apps/notes`, sign in, create a note, edit it, and delete it. Use a second Google
   account to confirm that the first account's notes remain inaccessible. An invalid
   deployment/client ID should show a connection/sign-in failure, not private data.

## Runtime boundary

`openid-client` performs OIDC discovery, code exchange, PKCE, state and nonce checks.
Explicit non-repudiation checks verify the ID-token signature against Google's JWKS;
the library also validates issuer, audience and expiry. The issuer is fixed to
`https://accounts.google.com`; URLs supplied by browsers cannot select a provider.

The login transaction lives in a ten-minute encrypted cookie. The callback consumes it
and exchanges the code using its PKCE verifier. The session is a `jose` A256GCM-encrypted
cookie with `HttpOnly`, `SameSite=Lax`, `/` path and `Secure` on HTTPS. Production names
use the `__Host-` prefix; HTTP cookies are allowed only on local loopback origins.
Origin validation uses `PUBLIC_SITE_URL`, never an untrusted incoming host as configuration.

The session lasts at most **one hour from sign-in**. A refresh token, when Google returns
one, renews an expiring ID token without extending that absolute application limit.
Google does not return a refresh token on every sign-in. An oversized refresh token is
omitted to keep the encrypted cookie below 3,800 characters; the user signs in again
when the ID token expires. A failed refresh clears the session. Forced refresh requests
use the refresh credential when available; otherwise a still-valid ID token is returned.
There is no long-lived refresh-token database.

`$lib/server/auth/session` exposes:

- `readSession(event)`: `null` or `{ subject, tokenIdentifier, email?, expiresAt }`.
  `email` is present only when verified by Google; authorization uses stable subject
  identity, never an editable email address. `expiresAt` is Unix milliseconds.
- `requireSession(event)`: the same safe shape, or a 401 response.
- `getConvexToken(event, { forceRefreshToken? })`: an ID token or `null`, for the Convex
  client/server connection. Do not log it or serialize it into layout/page data.

`POST /auth/token` accepts optional `forceRefreshToken` (boolean) and
`expectedTokenIdentifier` (nonempty string, at most 2,048 characters) from the configured
origin. The browser sends its displayed session identity; a different cookie identity
returns a null token, so a second-tab account switch cannot authenticate the old page
as the new owner. The expected identity constrains token delivery and never grants access.
The endpoint returns an uncached `{ idToken }` response. The browser passes that token to
the Convex auth client in memory. The refresh token remains in the encrypted HttpOnly
cookie. `POST /auth/logout` requires the same origin and clears the cookies. There is
no GET logout endpoint.

## Private Convex example

`src/convex/notes.ts` implements `list`, `create`, `update` and `remove`. Every operation
authenticates on the backend. The owner comes from `ctx.auth.getUserIdentity()` and is
stored as `tokenIdentifier`; no API accepts an owner ID supplied by the browser.
Updates and deletions check ownership again after reading the record. Missing and
other-user IDs return the same error.

The `by_owner` index bounds reads to 100 notes per account. Each note contains 1–2,000
trimmed characters. The list omits the owner field from its response. This intentionally
small example needs pagination and a product-specific quota policy if those limits change.

## Verification and limits

The tests exercise the actual OIDC library against a local mocked discovery/token/JWKS
transport with signed test keys: PKCE exchange, invalid state/nonce/signature/audience/
expiry, refresh and subject mismatch. Cookie and route tests cover encryption, expiry,
one-use browser transactions, refresh failure, oversized credentials, origin enforcement
and disabled defaults. `convex-test` checks anonymous denial, owner isolation, validators,
CRUD and quotas. These tests are not a real Google consent or deployed multi-account test.

Stateless sign-out clears this browser's session; it does not revoke Google's consent,
log out other devices or invalidate previously copied cookies. A copied Google ID token
remains acceptable to Convex until its own expiry, which can outlast the application
session after renewal. Rotating `AUTH_SESSION_SECRET` invalidates application cookies,
not already-issued Google tokens. A product needing immediate global logout, account
suspension or device revocation needs a revocable server session/authorization design
and corresponding backend checks before launch.

Sources: [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect),
[openid-client](https://github.com/panva/openid-client),
[Convex custom OIDC](https://docs.convex.dev/auth/advanced/custom-auth),
[Convex test harness](https://docs.convex.dev/testing/convex-test).

## Client lifetime and local failure coverage

The layout uses an account-keyed Convex provider. Changing verified issuer/subject
destroys the former client, subscriptions, query cache and pending authentication
callbacks before the new client confirms authentication. Private note form state
exists only while the backend confirms sign-in; losing authentication discards the
draft and edit selection. A failed save for the same authenticated owner preserves
the draft. Old mutation completions cannot update a new owner's form.

`bun run test:notes` runs a loopback-only Vite fixture on port 4198, with the actual
provider, convex-svelte and note components. The Convex browser client (including its
auth/cache behavior) and token HTTP responses use synthetic fixtures. The fixture covers delayed account confirmation, auth
loss/recovery, late mutations, query failure/recovery and safe save errors on desktop
and phone. It neither bypasses production auth nor proves deployed provider/JWT
configuration. Architecture snapshot persistence remains a backend API; the public
canvas has no private snapshot-save UI.
