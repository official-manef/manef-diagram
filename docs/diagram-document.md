# Diagram document and converters

MANEF Diagram uses one versioned document for its architecture graph, nested diagrams,
all 24 bundled Mermaid view kinds, editor state and provider-specific payloads. JSON
and Markdown serialize that document. The n8n adapter keeps an imported workflow in
the same document and provides a graph projection for inspection.

The source contract is [document.ts](../slices/architecture-inventory/lib/document.ts),
with [graph types](../slices/architecture-inventory/types.ts),
[JSON validation](../slices/architecture-inventory/lib/json.ts) and
[n8n conversion](../slices/architecture-inventory/lib/n8n.ts).

## Canonical JSON

```json
{
	"format": "manef-diagram",
	"schemaVersion": 1,
	"title": "My diagram",
	"graph": {
		"schemaVersion": 1,
		"nodes": [],
		"edges": []
	},
	"ui": {
		"diagramMode": "flow",
		"positions": {},
		"layouts": { "[]": {} }
	},
	"extensions": {}
}
```

`graph` retains node and edge IDs, labels, tags, input/output ports, edge endpoints,
child diagrams, authored views and JSON-safe extension fields. Node `child` values
use the same graph contract. `MAX_DIAGRAM_DEPTH` is 3, with the root at depth 0.
The same graph can be displayed in flow and graph layouts.

`ui` is optional. It can retain theme, layout mode, trace/focus mode, search/filter
state, open child path, camera pan/zoom and node positions. `ui.positions` contains
the current diagram's `{x,y}` coordinates by node ID. `ui.layouts` retains layouts
by `JSON.stringify(path)`; the root key is `"[]"`. Optional `inventory` retains the
document's inventory records.

Unknown JSON-safe fields are preserved at the document, graph, node, port, edge,
view, inventory and UI boundaries. `extensions` holds namespaced provider payloads
such as `extensions.n8n`. Imported records remain data; importing a document does
not execute expressions or provider operations.

Lossless means semantic JSON equality: the same values, object properties and array
ordering survive an export/import cycle. Formatting, object-key presentation order
and numeric literal spelling can change. Numeric parsing follows JavaScript Number
semantics; store precision-sensitive decimals as strings. The model accepts finite numbers, strings,
booleans, null, dense arrays and ordinary JSON objects. Integer numbers must be
within JavaScript's safe integer range; represent larger identifiers and counters
as strings. Negative zero is rejected because JSON serialization would change it
to zero. Unsupported JavaScript values, cycles, accessors and invalid required structures produce errors instead of
being silently omitted. JSON validation bounds nesting and value count; document
text import/export is limited to 5,000,000 characters.

## Markdown

Markdown exports contain human-readable Mermaid projections plus exactly one
authoritative `manef-diagram-json` fenced block holding the complete document.
The exporter sizes fences to contain authored backticks safely. The importer
accepts backtick or tilde fences and rejects absent, duplicate or unclosed canonical
blocks.

For structural changes in a Markdown document, edit the canonical JSON block and
regenerate the projections. Editing only a readable Mermaid projection leaves the
canonical document unchanged. A standalone Mermaid block does not contain enough
information to restore ports, nested diagrams, metadata, UI state or n8n payloads.

Every bundled view kind stays in `node.views` with its ID, kind, title, authored
format and complete source:

| Group     | Kinds                                                                                   |
| --------- | --------------------------------------------------------------------------------------- |
| Process   | Flowchart, sequence, state, user journey, Ishikawa                                      |
| Structure | Class, entity relationship, C4, block, architecture, packet, mindmap, tree, requirement |
| Planning  | Gantt, timeline, Git graph, Kanban                                                      |
| Charts    | Pie, quadrant, XY, radar, Sankey, treemap                                               |

Individual view conversions use `convertNodeView(view, 'md' | 'json')`. Their
`manef-node-view` envelope and `manef-node-view-json` Markdown block retain the
authored source and view metadata while exposing a Mermaid preview. Whole-document
conversion retains each authored view through the canonical document payload.
These operations preserve each kind's source; they do not translate a chart's
meaning into another diagram language.

## API and legacy imports

```ts
import {
	createDocument,
	documentAsJson,
	documentAsMarkdown,
	parseDiagramDocument,
	parseDiagramMarkdown,
	validateDiagramDocument
} from './slices/architecture-inventory/lib/document';

const document = createDocument(graph, 'Service map');
const json = documentAsJson(document);
const markdown = documentAsMarkdown(document);
const restored = parseDiagramMarkdown(markdown);
const restoredFromJson = parseDiagramDocument(json);
```

`validateDiagramDocument(value)` checks the envelope, graph and optional UI/inventory
without changing the input. `cloneDocument` returns an independent validated copy.
`cloneJson`, `isJsonValue` and `sameJson` are available for JSON-safe integration and
semantic round-trip checks.

`parseDiagramDocument` also accepts the existing bare graph and untagged `{graph,...}`
export shapes. It migrates them to the version 1 document, retaining JSON-safe
fields. Explicit unsupported formats or versions fail with an actionable error.
Legacy graph-only consumers can continue to use the graph parser; a consumer that
must retain the complete document should use the document APIs above.

## n8n workflow preservation

The adapter reference is n8n **2.43.7**, source commit
[`b7c54308e4d782af48043acf6558926f2f1f8e3b`](https://github.com/n8n-io/n8n/commit/b7c54308e4d782af48043acf6558926f2f1f8e3b).
`N8N_REFERENCE` exports that pin and its official source links.

```ts
import {
	importN8nWorkflow,
	exportN8nWorkflow,
	n8nCompatibility
} from './slices/architecture-inventory/lib/n8n';

const document = importN8nWorkflow(workflowJson);
const markdown = documentAsMarkdown(document);
const restored = parseDiagramMarkdown(markdown);
const compatibility = n8nCompatibility(restored);
const originalWorkflow = exportN8nWorkflow(restored);
const inactiveWorkflow = exportN8nWorkflow(restored, { mode: 'inactive' });
```

`importN8nWorkflow` accepts one workflow JSON string or JSON object. It retains the
complete workflow and a baseline graph in `extensions.n8n`. Graph IDs use stable
node ordinals; original n8n IDs remain in the workflow. n8n names resolve connection
references. The projection retains observed source/destination connection types and
output/input indexes, including AI and future channel names. Original array order,
fan-out, null/empty output slots, coordinates, expressions, credential references,
settings, pinned data, version metadata and unknown fields remain in the preserved
payload. See the pinned [n8n workflow interfaces](https://github.com/n8n-io/n8n/blob/b7c54308e4d782af48043acf6558926f2f1f8e3b/packages/workflow/src/interfaces.ts).

Node names must be unique, endpoints must resolve, and nodes must explicitly carry
their type, positive version, parameters and coordinates. Duplicate endpoint/port
connections are rejected before a document is returned because the architecture
graph requires unique connections. Imports are bounded to 2,000 nodes and 10,000
connections/output slots, and the expanded canonical envelope must fit the document
size limit.

`n8nCompatibility` returns `{compatible, diagnostics}` with stable diagnostic codes,
severity and actionable messages. Before n8n export, it checks the raw workflow,
baseline and current projected graph. Graph edits that cannot be mapped safely to
the executable workflow block export. The edited canonical JSON/Markdown document
can still be saved. Re-importing the intended n8n source restores a compatible
projection. Canvas display settings remain in the MANEF document; preservation
export retains n8n's original node coordinates.

The default `preserve` export returns semantically identical workflow JSON. The
explicit `inactive` export sets `active:false` and clears an existing
`activeVersionId`. It leaves the document's original workflow unchanged. n8n's
[import service](https://github.com/n8n-io/n8n/blob/b7c54308e4d782af48043acf6558926f2f1f8e3b/packages/cli/src/services/import.service.ts)
also defaults to inactive imports; publishing or activation remains a separate
destination operation. Arbitrary diagram shapes have no executable n8n binding,
so direct n8n export asks for an imported n8n workflow instead of choosing node
types or credentials on the user's behalf.

Workflow JSON can contain credential reference names and literal request headers.
Keep exports within their intended audience, as described in n8n's official
[export/import documentation](https://docs.n8n.io/build/manage-workflows/export-and-import/).
Credential references remain references; the converter does not fetch credentials,
install node packages, resolve subworkflow IDs or make network requests.

## Acceptance boundaries

Offline regression tests cover canonical JSON/Markdown equality, all bundled view
kinds, nested diagrams, unknown metadata, n8n branches/cycles, typed multi-input and
AI connections, null/empty slots, expressions, pinned data, credentials references,
bounds and rejected stale projections. The ready-to-import converter workflow uses
Manual Trigger and the JavaScript Code node with a bundled copy of the same core;
its build and offline smoke are separate checks.

Local structural tests and Code-node smoke do not establish that a particular n8n
instance has compatible packages, credentials, subworkflows or runtime settings.
Importing and manually exercising the inactive converter on a destination n8n
instance remains a separate acceptance gate. No production activation, provider
access or live workflow execution is required for local conversion tests.
