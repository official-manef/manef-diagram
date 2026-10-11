# Optional BYOK chat and MCP

`/apps/assistant` contains real provider chat and a separate, manually operated remote
tool panel. All three capabilities default to disabled, so a clone starts without AI
accounts, API keys or MCP connections. The screen is loaded only when its feature route
opens; provider SDKs and connection settings stay in server modules.

## Access and keys

Set `PUBLIC_SITE_URL` to the exact trusted application origin. Chat and remote-tool
requests require either the [Google session](auth.md) or a private
`CAPABILITY_ACCESS_TOKEN` of at least 32 characters. The latter is an operator credential
for a controlled installation, not a tenant permission model. A user enters it into the
page only when session sign-in is unavailable. Never put it in a `PUBLIC_` variable.

Provider API keys and MCP credentials are supplied separately by the user, with every
request. Password inputs and chat history live only in the mounted page's memory;
clearing the page or navigating away removes them. The starter does not write these
values to cookies, browser storage, Convex, analytics or logs. Requests pass through the
application server to the selected service. Use a trusted HTTPS deployment and disable
request-body/authorization-header logging in hosting, proxies and observability tools.
The remote provider's own retention and billing policies still apply.

POST routes compare `Origin` against configuration, not an incoming `Host` header.
The shared guard accepts no anonymous fallback and applies 20 requests per minute per
principal, with at most 1,024 active in-memory buckets. These are process-local limits;
add an edge/distributed limiter, product quotas and tenant policy before scaling.
The operator credential grants capability access; a provider key is never treated as
application authorization.

## Enable chat

Set `AI_ENABLED=true` and `AI_MODELS_JSON` on the SvelteKit server. The JSON object accepts
the keys `openai`, `anthropic` and `google`, each with an array of approved model IDs.
Include only models verified against your provider account and current provider docs.
There is no automatic model choice or fallback when a selected model is unavailable.

```json
{
	"openai": ["replace-with-approved-model-id"],
	"anthropic": [],
	"google": []
}
```

This example is configuration structure, not a working model ID. After replacing it,
open the Assistant screen, check setup, select the provider/model, enter your own key,
and send a message. Switching providers clears the previous provider key. The page
shows streamed text, partial failures and a stop button. Starting another conversation
uses **Clear keys and conversation**.

The implementation uses the official AI SDK adapters for
[OpenAI](https://ai-sdk.dev/providers/ai-sdk-providers/openai),
[Anthropic](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) and
[Google](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai).
Server code fixes their respective HTTPS API hosts and rejects redirects. It does not
accept browser-supplied endpoints, attachments, tools, system messages or extra provider
options. OpenAI response storage is explicitly disabled; this is not a promise that
every provider or hosting system retains no data.

Each request allows at most 16 messages and 32,000 total characters, with 8,000 characters
per user message. Replies stop at 4,096 output tokens or 32,000 characters, with a
60-second deadline and no automatic retries. An approved model must support these
settings. Browser cancellation aborts the upstream request but cannot undo consumed
provider usage. JSON bodies also have a 64 KiB wire limit, which can be reached sooner
with multibyte text. Streaming errors are generic; the supplied key is redacted even if
an upstream response echoes it across text chunks. See the AI SDK's
[streaming API](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) and
[error handling](https://ai-sdk.dev/docs/ai-sdk-core/error-handling).

## Connect remote tools

Set `MCP_CLIENT_ENABLED=true` and configure private `MCP_SERVERS_JSON`. Each connection
needs an alias, a final public HTTPS Streamable HTTP endpoint, an authentication header
convention, and an exact allowlist of directly callable tools:

```json
[
	{
		"alias": "approved-service",
		"url": "https://mcp.example.com/mcp",
		"auth": "bearer",
		"tools": ["EXACT_TOOL_NAME"]
	}
]
```

Replace the example endpoint and tool with your service's actual values. The only
supported header conventions are `bearer` and `x-api-key`. The browser receives aliases
only; it supplies a token separately. Credentials must not be embedded in URLs.
Configuration rejects HTTP, IP literals, local names, URL credentials, fragments,
nonstandard ports and common credential query parameters. Configure only trusted
public endpoints under reliable DNS; enforce outbound network policy when your hosting
environment requires protection against DNS changes. Redirects are rejected, so approve
the final endpoint before adding it. Browser requests cannot select an arbitrary URL.

Discovery is on demand through the official MCP
[Streamable HTTP client](https://ts.sdk.modelcontextprotocol.io/client). A connection is
bounded to eight discovery pages, 128 advertised tools and a 15-second deadline; repeated
or incomplete pagination fails. Only tools present in the local allowlist are displayed.
Each response is capped at 2 MiB. Each request owns its connection and closes it in
`finally`, attempting remote session termination with a separate two-second cleanup
deadline when the server uses sessions. There is no global catalog or background poll.

Select a tool, inspect its untrusted description/schema, enter a JSON argument object,
then choose **Review tool call**. The confirmation shows the exact server, tool and
arguments; **Confirm and execute once** submits that snapshot. Server code checks the
allowlist before network access and rediscovers the tool before each call. Arguments
are bounded to 16,000 serialized characters, results to 64,000. Remote servers validate
their tool-specific argument schema. Descriptions and results are displayed as text,
with the supplied credential and configured endpoint redacted.

The model has no connection to these tools and never executes them automatically.
Manual UI confirmation expresses intent for that request; it is not a signed approval
record or an exactly-once transaction guarantee. There are no automatic retries. A
cancelled or failed request may have completed remotely, so inspect the external state
before trying again. Product workflows that require durable approval, idempotency,
audit records or narrower user permissions must implement them before enabling tools
with those requirements. Do not treat a tool's read-only annotation as an authorization
decision.

### Composio

Use a Composio **session with MCP enabled and the direct-tools preset** for new
integrations. Scope the session to one authenticated user and an explicit set of toolkit
tools. Read the endpoint and required headers from `session.mcp.url` and
`session.mcp.headers`; map the returned `x-api-key` or bearer requirement to this
starter's supported auth setting. Supply its credential through the remote-tools panel,
not the endpoint URL. The starter does not create Composio sessions or store their keys.

Follow the current [sessions via MCP](https://docs.composio.dev/docs/sessions-via-mcp)
and [session configuration](https://docs.composio.dev/docs/configuring-sessions) guides.
The direct-tools preset exposes the selected tools without search/execution metatools.
Composio's [legacy standalone MCP API](https://docs.composio.dev/reference/api-reference/mcp)
is deprecated; an existing single-toolkit endpoint can still be configured here while
its owner follows Composio's migration guidance. If an endpoint redirects, approve its
final Streamable HTTP URL first; runtime redirects remain disabled.

This starter deliberately rejects `COMPOSIO_*` router/execution metatools: allowing a
generic execution tool would bypass a direct-tool allowlist. Sessions
using dynamic search/execution metatools are therefore not enabled by this preset. The application
does not provision Composio configurations, complete toolkit OAuth or store connected
accounts. Generated URLs can identify a particular connected user: use them only in a
controlled installation, or add authenticated per-user connection ownership and encrypted
credential storage before offering a multi-tenant connected-account product. An alias
alone does not establish that ownership.

## Expose the read-only MCP server

Independently set `MCP_SERVER_ENABLED=true` and a separate private `MCP_SERVER_TOKEN`
between 32 and 4,096 characters. An external MCP client connects to
`https://your-domain.example/api/mcp/server` using Streamable HTTP and
`Authorization: Bearer <your-server-token>`.

The official SDK's
[Web Standard server transport](https://ts.sdk.modelcontextprotocol.io/server) runs
statelessly and advertises ten read-only graph tools:

- `graph_status`: public graph counts, package name and version.
- `graph_list_nodes`, `graph_list_edges`, `graph_adjacency`: public services and relationships.
- `graph_trace`, `graph_layout`: connection traces and calculated layouts.
- `graph_search_inventory`: public inventory references.
- `graph_query`, `graph_build_view`: bounded graph queries and portable view URLs.
- `graph_create_portable_view`: validates a caller-supplied graph and builds a portable URL.

These tools do not persist editor changes, access private Convex records, expose
environment values or prove deployment health. Tool inputs remain bounded and validated. The
endpoint requires constant-time bearer verification and rate limiting. If an Origin
header is present, it must match `PUBLIC_SITE_URL`; non-browser MCP clients may omit it.
There is no trust decision derived from the request Host. Only POST is supported; GET
and DELETE return method-not-allowed for this stateless transport.

The Diagram production endpoint is `https://diagram.manef.dev/api/mcp/server`. The public
landing and `/guide?section=mcp` provide endpoint copying, connection steps and error
guidance. Use a client supporting Streamable HTTP and a custom Authorization header:
add the endpoint, configure the server token privately, refresh tools and call
`graph_status`. A client requiring OAuth without bearer-header support is incompatible.
Do not paste tokens into the public map, portable URLs or the simulated workspace playground.
401 means missing/invalid token, 404 disabled server, 503 missing server configuration,
and 429 rate limiting. The workspace playground remains a browser-local simulation.

### Connect Codex CLI and desktop with the replacement token

Codex CLI and desktop on the same host share `~/.codex/config.toml`.
Use [Codex's documented Streamable HTTP bearer configuration](https://developers.openai.com/codex/mcp).
The deployment owner provides the current token privately; it is not available from
this public guide. The server variable is `MCP_SERVER_TOKEN`; the client variable
below is `MCP_DIAGRAM_TOKEN`. Their secret values must match.

1. Enter the token in the environment of the computer running Codex. On Windows,
   this prompt masks input and keeps the value out of command history:

   ```powershell
   $env:MCP_DIAGRAM_TOKEN = [System.Net.NetworkCredential]::new('', (Read-Host 'Diagram token' -AsSecureString)).Password
   ```

2. Register the server once (this command contains no credential):

   ```sh
   codex mcp add diagram --url https://diagram.manef.dev/api/mcp/server --bearer-token-env-var MCP_DIAGRAM_TOKEN
   ```

   Alternatively, add this table once to `~/.codex/config.toml`:

   ```toml
   [mcp_servers.diagram]
   url = "https://diagram.manef.dev/api/mcp/server"
   bearer_token_env_var = "MCP_DIAGRAM_TOKEN"
   ```

3. Launch `codex` from that shell. For desktop, fully quit the app and launch its
   installed executable from the same environment. Setting a terminal variable
   does not update an already-running app or a remote host. Configure each host
   separately through its private secret environment. Do not put a literal token
   in TOML, a URL, a committed environment file, or a chat message.
4. Refresh MCP tools and expect all ten names below. Call `graph_status` with `{}`.
   Get public node IDs from `graph_list_nodes` before calling trace/view tools.
   `codex mcp list` checks registration, not an authenticated tool connection.
5. After rotation, replace the client environment value and restart/reconnect.
   401 usually means a missing, retired or wrong token; check which host launched
   the client. 429 means wait at least one minute before retrying. Do not use
   `codex mcp login diagram`: this endpoint has no OAuth login flow.

After closing that client, clear a temporary PowerShell token with
`Remove-Item Env:MCP_DIAGRAM_TOKEN`. This does not revoke a running child's copy;
close the child or update the server credential to revoke it.

### Connect with the official TypeScript client

Use the installed `@modelcontextprotocol/sdk` dependency. Set `MCP_DIAGRAM_TOKEN` in
the client process's private environment using your secret manager; do not commit it
or paste it into a public page. This is a client-side variable, separate from the
server's `MCP_SERVER_TOKEN` setting.

```js
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const token = process.env.MCP_DIAGRAM_TOKEN;
if (!token) throw new Error('Configure the private MCP_DIAGRAM_TOKEN first.');
const client = new Client({ name: 'diagram-client', version: '1.0.0' });
const transport = new StreamableHTTPClientTransport(
	new URL('https://diagram.manef.dev/api/mcp/server'),
	{ requestInit: { headers: { Authorization: `Bearer ${token}` } } }
);
try {
	await client.connect(transport, { timeout: 15000 });
	const { tools } = await client.listTools();
	console.log(tools.map((tool) => tool.name));
	const result = await client.callTool({ name: 'graph_status', arguments: {} });
	if (result.isError) throw new Error('graph_status failed.');
	console.log(result.content);
} finally {
	await client.close();
}
```

Reuse a connected client for successive calls. The server guard allows 20 requests
per minute per token in each running process; initialization and notifications also
count. A 429 requires waiting before retrying. Limits are process-local, not a
distributed production quota. A background GET for an event stream returns 405 on
this stateless endpoint; successful POST discovery/calls remain the acceptance signal.

### Codex runtime and light load acceptance — 2026-10-11

The replacement production token passed all ten tools through the installed
Codex 0.160.1 app-server MCP runtime, using its direct tool-call API with an
in-memory test context and no model turn. Registration reported
`bearerToken` / `connected`, and all ten tool annotations were read-only and
non-destructive. This tests the installed client's MCP transport and calls;
click-through of the already-running desktop UI was not tested.

Tested production revision: `99adbbe37b0f0b3c721721414debfca79d6c1740`,
deployment `dpl_5SVUPJVaao5kqzfDwtJrj7MCq3Mh`, at 12:26–12:29 WIB.
Counts stayed at 23 nodes / 22 edges; the portable view remained unpersisted.
Invalid tool input was rejected; anonymous and invalid-token requests returned
401, and a valid token with an untrusted Origin returned 403. The retired-token
401 check was completed separately during rotation on the same release.

A bounded load test reused that Codex connection: 24 `graph_status` calls,
at most two outstanding, in 4,039 ms. All 24 succeeded, with zero errors or
observed 429 responses. Warm-call latency was p50 270 ms, p95 351 ms and max
929 ms. The first functional call took 6,973 ms and is excluded from these
warm-load percentiles. A health call after a 65-second cooldown passed with
unchanged counts, and the test client closed.

This small sample establishes functional behavior under light load, not
capacity or a global rate ceiling. No 429 recovery was exercised because no
429 occurred. The process-local guard can be spread across serverless instances;
a distributed limiter is required before relying on a shared production quota.

### Initial SDK production acceptance — 2026-10-11

The official SDK client `1.30.0` completed initialize, discovery of all ten tools,
and successful calls to every tool at `https://diagram.manef.dev/api/mcp/server`.
The tested release was `a46a441746cf4496680f13b4323bec87e9799ce1`, deployment
`dpl_2feFCpbZrAgHZS8yELqHdoKxcxFo`; the server reported version `0.1.0`.

| Tool                         | Example arguments                                                   | Observed production result                           |
| ---------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| `graph_status`               | `{}`                                                                | 23 nodes, 22 edges, schema version 1                 |
| `graph_list_nodes`           | `{}`                                                                | 23 public nodes                                      |
| `graph_list_edges`           | `{}`                                                                | 22 edges                                             |
| `graph_trace`                | `{ "seeds": ["NODE_ID"], "mode": "direct" }`                        | Diagram node plus direct neighbors: 7 nodes, 6 edges |
| `graph_layout`               | `{ "mode": "flow" }`                                                | Finite positions for all 23 nodes                    |
| `graph_search_inventory`     | `{ "query": "" }`                                                   | 3 public inventory references                        |
| `graph_adjacency`            | `{}`                                                                | 23 entries; edge endpoints matched both directions   |
| `graph_query`                | `{ "query": "diagram.manef.dev" }`                                  | 1 matching node and a valid `/app` view URL          |
| `graph_build_view`           | `{ "seeds": ["NODE_ID"], "focus": true }`                           | Valid `/app` URL with focus state                    |
| `graph_create_portable_view` | `{ "graph": { "schemaVersion": 1, "nodes": [NODE], "edges": [] } }` | Valid graph URL; 1 node, 0 edges, `persisted: false` |

Get `NODE` and its `NODE_ID` from `graph_list_nodes`; placeholders above are not literal
arguments. The portable graph test reused a returned public node. Server counts remained
unchanged afterward. Empty trace seeds returned a tool error; anonymous and invalid-token
POSTs returned 401, and an authenticated request with an untrusted Origin returned 403.
The client closed successfully. Configuration checks confirmed an enabled server,
encrypted token of valid length and the correct public origin. The credential targets
production and preview; the initial acceptance run used the existing token.

To rotate a credential, update the private `MCP_SERVER_TOKEN` value, then redeploy the
affected environments and update client secret settings. An environment edit alone
does not change already-built deployments. Verify that the old token returns 401 on
the production endpoint and repeat discovery and all ten calls with the new token.
Check retained deployment URLs separately; their environment snapshots can differ.
Use secret-management operations that suppress decrypted values in tool output.

This proves the controlled read-only endpoint using the official SDK, not compatibility
with every client UI, OAuth, private inventory or persisted writes. Keep credentials
out of tool output, request logs and QA reports; record token rotation separately from
functional acceptance when required.

This is a controlled bearer-token integration, not a full OAuth authorization server or
a generic proxy to remote tools. To add business tools, define backend authorization,
validated inputs, tenant ownership and data minimization for each tool. Keep this status
endpoint independent of user BYOK credentials.

## Verification and extension boundaries

Focused tests use mock provider streams/HTTP only: configuration rejection, fixed
provider hosts, bounded generation, key redaction, cancellation, actual official MCP
discovery/call serialization, allowlist and confirmation checks, session termination,
pagination failures and the read-only server contract. No paid generation, Composio
account, third-party action or live provider lifecycle is validated by those tests.

Before application release, validate an allowed model and cancellation against your own
provider account, and exercise discovery, a harmless tool, failure and cleanup against
your approved remote server. Confirm that deployment timeouts and proxy buffering allow
streaming. Keep SDK upgrades behind these contract tests. Add provider-specific adapters
only when needed; never turn an environment string into an arbitrary API endpoint or
silently substitute a different provider. See [environment.md](environment.md) for the
actual consumers of every setting.
