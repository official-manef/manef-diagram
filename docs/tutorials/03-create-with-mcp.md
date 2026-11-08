# Create diagrams through MCP

For an agent connected through Model Context Protocol, the Diagram app exposes a
**read-only** MCP server that can validate a graph you supply and return a
portable view URL. This tutorial covers the full loop: connect, discover, create
a portable view, hand it to a human.

The full operational guide (tokens, rotation, client setup, acceptance history)
lives in [ai-mcp.md](../ai-mcp.md). This page is the task-oriented path.

## 1. Connect

- Endpoint: `https://diagram.manef.dev/api/mcp/server` (Streamable HTTP, POST only).
- Auth: `Authorization: Bearer <token>` — the deployment owner supplies the token
  privately. Never place it in a URL, a portable view or a chat message.
- Errors: 401 missing/invalid token · 403 untrusted Origin · 404 disabled server ·
  503 missing server configuration · 429 rate limited (20 req/min per token,
  process-local — wait, do not hammer).

Any Streamable HTTP MCP client with a custom bearer header works. Clients that
require OAuth do not — there is no OAuth login flow on this endpoint.

## 2. Discover and orient

Ten read-only tools are advertised:

| Tool                         | Use it to                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `graph_status`               | health check; public node/edge counts                                         |
| `graph_list_nodes`           | list public nodes (get IDs here first)                                        |
| `graph_list_edges`           | list public edges                                                             |
| `graph_adjacency`            | node → neighbors map                                                          |
| `graph_trace`                | connection traces from seed nodes (`mode`: `direct` \| `component`)           |
| `graph_layout`               | computed layout for all nodes                                                 |
| `graph_search_inventory`     | search public inventory references                                            |
| `graph_query`                | bounded query; returns a matching node and an `/app` view URL                 |
| `graph_build_view`           | portable view of the **public** graph from seeds (`focus: true` focuses them) |
| `graph_create_portable_view` | validate **your own** graph and get a portable URL                            |

Call `graph_status` with `{}` first. Get node IDs from `graph_list_nodes` before
trace/view tools; empty trace seeds are a tool error.

## 3. Create a portable view of your own graph

`graph_create_portable_view` validates the graph you send and returns a URL whose
link encodes the graph. Nothing is persisted (`persisted: false`);
counts on the server stay unchanged.

```json
{
	"graph": {
		"schemaVersion": 1,
		"nodes": [
			{
				"id": "client",
				"label": "Browser client",
				"tags": [],
				"inputs": [],
				"outputs": [{ "id": "out", "label": "requests" }]
			},
			{
				"id": "api",
				"label": "Public API",
				"tags": [],
				"inputs": [{ "id": "in", "label": "requests" }],
				"outputs": []
			}
		],
		"edges": [
			{
				"id": "client-to-api",
				"source": "client",
				"sourcePort": "out",
				"target": "api",
				"targetPort": "in",
				"label": "HTTPS"
			}
		]
	}
}
```

The result contains a valid graph URL you can open at `/app` or embed — hand it
to the user. The same node/edge contract and limits apply as in
[the format reference](02-diagram-format.md).

## 4. Verify

- Open the returned URL: the diagram renders the graph you sent.
- Call `graph_status` again afterwards: counts unchanged (the call was read-only).
- Invalid input (missing port, duplicate ID, wrong version) returns a tool error —
  fix the graph, do not retry the same payload.

## Boundaries

- These tools never persist editor changes, access private Convex records, expose
  environment values or prove deployment health.
- A portable URL is only as sensitive as its content — do not encode secrets into
  node labels or extensions.
- For durable, multi-user storage you need the editor's authenticated flows, not
  this read-only server.
