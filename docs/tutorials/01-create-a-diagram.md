# Create your first diagram

This is the fastest complete path from nothing to a working MANEF Diagram.
Every snippet below is a valid document you can paste or import.

## 1. Build the document

A document is one JSON object with the canonical envelope, a graph of `nodes`
and `edges`, and (optionally) `ui` state and `extensions`.

Minimal single-node diagram:

```json
{
	"format": "manef-diagram",
	"schemaVersion": 1,
	"title": "My first diagram",
	"graph": {
		"schemaVersion": 1,
		"nodes": [
			{
				"id": "api",
				"label": "Public API",
				"tags": ["service"],
				"inputs": [{ "id": "in", "label": "requests" }],
				"outputs": [{ "id": "out", "label": "responses" }]
			}
		],
		"edges": []
	}
}
```

Two connected nodes:

```json
{
	"format": "manef-diagram",
	"schemaVersion": 1,
	"title": "Client to API",
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

Rules that matter most:

- `format` must be `"manef-diagram"` and `schemaVersion` must be `1` (document and
  graph both).
- `id` values must be unique within their scope (nodes, ports per node, edges).
- Every edge endpoint must reference an existing node, and its `sourcePort` /
  `targetPort` must reference existing ports **on those nodes**.
- Unknown JSON-safe fields are preserved; you can attach extra metadata to nodes
  and edges without breaking validation.

## 2. Load it into the editor

Open `https://diagram.manef.dev/app` and import the JSON document
(the editor also accepts the legacy bare-graph shape and Markdown with a canonical
`manef-diagram-json` fenced block). The editor validates, renders the flow/graph
layout and keeps the document in browser-local storage.

## 3. Verify what you made

- The diagram renders without validation errors.
- Every edge visually connects the ports you declared.
- Exporting again produces a document that imports back losslessly (semantic JSON
  equality — formatting may differ, values may not).

## What it is not

Importing a document does not create an account, a database record or a deployment.
The editor holds the document locally until you export or share it. For a URL you
can hand to someone else without persisting anything, use the MCP portable-view
path in [tutorial 3](03-create-with-mcp.md).

For nested diagrams, the 33 bundled view kinds, `ui` state and hard limits, read
[the format reference](02-diagram-format.md).
