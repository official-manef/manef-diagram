import type { NodeView } from '../types';
import { isJsonValue, sameJson } from './json';

export type { NodeView };
export type DiagramKind = (typeof DIAGRAM_KINDS)[number]['id'];

export const DIAGRAM_KINDS = [
	{ id: 'flowchart', label: 'Flowchart', group: 'Process', keyword: 'flowchart' },
	{ id: 'sequence', label: 'Sequence', group: 'Process', keyword: 'sequenceDiagram' },
	{ id: 'state', label: 'State', group: 'Process', keyword: 'stateDiagram-v2' },
	{ id: 'journey', label: 'User journey', group: 'Process', keyword: 'journey' },
	{ id: 'class', label: 'Class', group: 'Structure', keyword: 'classDiagram' },
	{ id: 'er', label: 'Entity relationship', group: 'Structure', keyword: 'erDiagram' },
	{ id: 'c4', label: 'C4', group: 'Structure', keyword: 'C4Context' },
	{ id: 'block', label: 'Block', group: 'Structure', keyword: 'block-beta' },
	{ id: 'architecture', label: 'Architecture', group: 'Structure', keyword: 'architecture-beta' },
	{ id: 'packet', label: 'Packet', group: 'Structure', keyword: 'packet-beta' },
	{ id: 'mindmap', label: 'Mindmap', group: 'Structure', keyword: 'mindmap' },
	{ id: 'tree', label: 'Tree', group: 'Structure', keyword: 'treeView-beta' },
	{ id: 'requirement', label: 'Requirement', group: 'Structure', keyword: 'requirementDiagram' },
	{ id: 'gantt', label: 'Gantt', group: 'Planning', keyword: 'gantt' },
	{ id: 'timeline', label: 'Timeline', group: 'Planning', keyword: 'timeline' },
	{ id: 'git', label: 'Git graph', group: 'Planning', keyword: 'gitGraph' },
	{ id: 'kanban', label: 'Kanban', group: 'Planning', keyword: 'kanban' },
	{ id: 'pie', label: 'Pie', group: 'Charts', keyword: 'pie' },
	{ id: 'quadrant', label: 'Quadrant', group: 'Charts', keyword: 'quadrantChart' },
	{ id: 'xy', label: 'XY chart', group: 'Charts', keyword: 'xychart-beta' },
	{ id: 'radar', label: 'Radar', group: 'Charts', keyword: 'radar-beta' },
	{ id: 'sankey', label: 'Sankey', group: 'Charts', keyword: 'sankey-beta' },
	{ id: 'treemap', label: 'Treemap', group: 'Charts', keyword: 'treemap-beta' },
	{ id: 'ishikawa', label: 'Ishikawa', group: 'Process', keyword: 'ishikawa-beta' }
] as const;

const TEMPLATES: Record<DiagramKind, string> = {
	flowchart: `flowchart LR
  A[Request] --> B{Valid?}
  B -->|yes| C[Run]
  B -->|no| D[Stop]`,
	sequence: `sequenceDiagram
  actor User
  participant App
  participant API
  User->>App: Open
  App->>API: Load
  API-->>App: Data`,
	state: `stateDiagram-v2
  [*] --> Idle
  Idle --> Running
  Running --> Idle
  Running --> [*]`,
	journey: `journey
  title Open a diagram
  section Visit
    Land on the map: 5: Visitor
  section Edit
    Add a view: 4: Editor`,
	class: `classDiagram
  class Node {
    +string label
  }
  class Edge {
    +string label
  }
  Node --> Edge`,
	er: `erDiagram
  NODE ||--o{ EDGE : connects
  NODE {
    string id
    string label
  }`,
	c4: `C4Context
  title System context
  Person(user, "Reader")
  System(diagram, "Diagram")
  Rel(user, diagram, "Opens")`,
	block: `block-beta
  columns 3
  A["Flow"] B["Graph"] C["View"]`,
	architecture: `architecture-beta
  group cloud(cloud)[Public]
  service map(server)[Map] in cloud
  service docs(disk)[Docs] in cloud
  map:R --> L:docs`,
	packet: `packet-beta
  0-15: "Source"
  16-31: "Target"`,
	mindmap: `mindmap
  root((Diagram))
    Flow
    Graph
    Mermaid`,
	tree: `treeView-beta
  Diagram
    Flow
    Graph
    Mermaid`,
	requirement: `requirementDiagram
  requirement view_req {
    id: "1"
    text: "a node can open a diagram view"
    risk: low
    verifymethod: test
  }
  element canvas {
    type: component
  }
  canvas - satisfies -> view_req`,
	gantt: `gantt
  title Release
  dateFormat YYYY-MM-DD
  section Build
    Map :a1, 2026-10-01, 7d
    Views :after a1, 5d`,
	timeline: `timeline
  title Map
  2026-10 : Public services
           : Mermaid views`,
	git: `gitGraph
  commit
  branch feature
  checkout feature
  commit
  checkout main
  merge feature`,
	kanban: `kanban
  Backlog
    Add a view
  Doing
    Draw the diagram
  Done
    Flow and graph`,
	pie: `pie title Nodes
  "Services" : 9
  "Modules" : 14`,
	quadrant: `quadrantChart
  title Priority
  x-axis Low --> High
  y-axis Low --> High
  quadrant-1 Do now
  quadrant-2 Plan
  quadrant-3 Later
  quadrant-4 Delegate
  Map: [0.75, 0.7]`,
	xy: `xychart-beta
  title "Nodes"
  x-axis [map, modules, views]
  y-axis "count" 0 --> 20
  bar [9, 14, 3]`,
	radar: `radar-beta
  title Coverage
  axis Flow, Graph, Data, Plan
  curve App{5, 4, 3, 2}`,
	sankey: `sankey-beta
Source,Flow,9
Source,Graph,5`,
	treemap: `treemap-beta
"Map"
  "Services": 9
  "Modules": 14`,
	ishikawa: `ishikawa-beta
  Slow response
    Code
      Missing cache
    Process
      No budget`
};

export function diagramKind(id: string): (typeof DIAGRAM_KINDS)[number] | undefined {
	return DIAGRAM_KINDS.find((item) => item.id === id);
}

export function isDiagramKind(id: string): id is DiagramKind {
	return diagramKind(id) !== undefined;
}

export const MAX_NODE_VIEW_SOURCE_LENGTH = 200_000;
const MAX_AUTHORED_SOURCE_LENGTH = 20_000;
const MAX_JSON_DEPTH = 24;
const VIEW_ENVELOPE_FORMAT = 'manef-node-view';
const VIEW_PAYLOAD_LANGUAGE = 'manef-node-view-json';

type ViewEnvelope = { format: typeof VIEW_ENVELOPE_FORMAT; schemaVersion: 1; view: NodeView };
type FencedBlock = { info: string; content: string; start: number; end: number };

function isRecord(value: unknown): value is Record<string, unknown> {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		(Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
	);
}

function assertJsonValue(value: unknown): void {
	if (!isJsonValue(value)) {
		throw new Error('Node view metadata must contain only finite, plain JSON values.');
	}
	const pending: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
	while (pending.length > 0) {
		const item = pending.pop()!;
		if (item.depth > MAX_JSON_DEPTH) throw new Error('Node view metadata is nested too deeply.');
		if (item.value !== null && typeof item.value === 'object') {
			for (const child of Object.values(item.value)) {
				pending.push({ value: child as unknown, depth: item.depth + 1 });
			}
		}
	}
}

function assertViewShape(value: unknown): asserts value is NodeView {
	if (
		!isRecord(value) ||
		typeof value.id !== 'string' ||
		value.id.length === 0 ||
		value.id.length >= 80 ||
		typeof value.kind !== 'string' ||
		!isDiagramKind(value.kind) ||
		typeof value.title !== 'string' ||
		typeof value.source !== 'string' ||
		value.source.length > MAX_NODE_VIEW_SOURCE_LENGTH ||
		(value.format !== 'md' && value.format !== 'json')
	) {
		throw new Error('Invalid node view.');
	}
	assertJsonValue(value);
	if (JSON.stringify(value).length > MAX_NODE_VIEW_SOURCE_LENGTH) {
		throw new Error('Node view exceeds the conversion size limit.');
	}
}

function fencedBlocks(source: string): FencedBlock[] {
	const blocks: FencedBlock[] = [];
	const lines = source.match(/[^\n]*(?:\n|$)/g) ?? [];
	let offset = 0;
	let open:
		{ marker: string; length: number; info: string; start: number; body: number } | undefined;
	for (const line of lines) {
		if (!open) {
			const match = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)\r?\n?$/.exec(line);
			if (match && !(match[1][0] === '`' && match[2].includes('`'))) {
				open = {
					marker: match[1][0],
					length: match[1].length,
					info: match[2].trim().toLowerCase(),
					start: offset,
					body: offset + line.length
				};
			}
		} else {
			const close = /^ {0,3}(`{3,}|~{3,})[ \t]*\r?\n?$/.exec(line);
			if (close && close[1][0] === open.marker && close[1].length >= open.length) {
				blocks.push({
					info: open.info,
					content: source.slice(open.body, offset),
					start: open.start,
					end: offset + line.length
				});
				open = undefined;
			}
		}
		offset += line.length;
	}
	if (open?.info === VIEW_PAYLOAD_LANGUAGE || open?.info === 'mermaid') {
		throw new Error('Node view has an unclosed diagram or canonical payload fence.');
	}
	return blocks;
}

function codeFence(language: string, content: string): string {
	const runs = content.match(/`+/g) ?? [];
	const width = Math.max(3, ...runs.map((run) => run.length + 1));
	const marker = '`'.repeat(width);
	return `${marker}${language}\n${content}\n${marker}\n`;
}

function envelopeValue(value: unknown): ViewEnvelope | undefined {
	if (!isRecord(value) || value.format !== VIEW_ENVELOPE_FORMAT) return undefined;
	if (value.schemaVersion !== 1) throw new Error('Unsupported node view schema version.');
	if (Object.keys(value).some((key) => !['format', 'schemaVersion', 'view'].includes(key))) {
		throw new Error('Node view wrapper has unsupported fields.');
	}
	assertViewShape(value.view);
	return value as ViewEnvelope;
}

function authoredMermaidSource(view: Pick<NodeView, 'format' | 'source'>): string {
	if (view.format === 'json') {
		const value: unknown = JSON.parse(view.source);
		if (isRecord(value) && typeof value.source === 'string') return value.source.trim();
		throw new Error('JSON view needs a source string.');
	}
	const blocks = fencedBlocks(view.source).filter((block) => block.info === 'mermaid');
	if (blocks.length > 1) throw new Error('Node view contains multiple Mermaid diagrams.');
	if (blocks.length === 1) return blocks[0].content.trim();
	return view.source.replace(/^#\s+.+\r?\n+/, '').trim();
}

function markdownEnvelope(envelope: ViewEnvelope): string {
	const preview = codeFence('mermaid', authoredMermaidSource(envelope.view));
	const payload = codeFence(VIEW_PAYLOAD_LANGUAGE, JSON.stringify(envelope, null, 2));
	const title = envelope.view.title.replace(/[\r\n]+/g, ' ');
	return `# ${title}\n\n${preview}\n${payload}`;
}

function readEnvelope(view: Pick<NodeView, 'format' | 'source'>): ViewEnvelope | undefined {
	if (view.source.length > MAX_NODE_VIEW_SOURCE_LENGTH) {
		throw new Error('Node view exceeds the conversion size limit.');
	}
	if (view.format === 'json') {
		let parsed: unknown;
		try {
			parsed = JSON.parse(view.source);
		} catch {
			if (view.source.includes(VIEW_ENVELOPE_FORMAT)) {
				throw new Error('Invalid node view wrapper JSON.');
			}
			return undefined;
		}
		return envelopeValue(parsed);
	}
	const blocks = fencedBlocks(view.source);
	const payloads = blocks.filter((block) => block.info === VIEW_PAYLOAD_LANGUAGE);
	if (payloads.length > 1) throw new Error('Node view contains multiple canonical payloads.');
	if (payloads.length === 0) return undefined;
	const envelope = envelopeValue(JSON.parse(payloads[0].content));
	if (!envelope) throw new Error('Invalid canonical node view payload.');
	if (view.source !== markdownEnvelope(envelope)) {
		throw new Error('Markdown preview does not match its canonical node view payload.');
	}
	return envelope;
}

function originalView(view: NodeView): NodeView {
	assertViewShape(view);
	const envelope = readEnvelope(view);
	const original = envelope?.view ?? view;
	if (envelope) {
		const metadata = (value: NodeView) =>
			Object.fromEntries(
				Object.entries(value).filter(([key]) => key !== 'source' && key !== 'format')
			);
		if (!sameJson(metadata(view), metadata(original))) {
			throw new Error('Node view wrapper metadata does not match its canonical payload.');
		}
	}
	if (envelope && readEnvelope(original))
		throw new Error('Nested node view wrappers are not supported.');
	if (original.source.length > MAX_AUTHORED_SOURCE_LENGTH) {
		throw new Error('Authored node view source exceeds 20,000 characters.');
	}
	return original;
}

export function isNodeView(value: unknown): value is NodeView {
	try {
		assertViewShape(value);
		originalView(value);
		return true;
	} catch {
		return false;
	}
}

export function convertNodeView(view: NodeView, target: 'md' | 'json'): NodeView {
	if (target !== 'md' && target !== 'json') throw new Error('Unsupported node view format.');
	const original = originalView(view);
	const clone = JSON.parse(JSON.stringify(original)) as NodeView;
	if (target === original.format) return clone;
	const envelope: ViewEnvelope = { format: VIEW_ENVELOPE_FORMAT, schemaVersion: 1, view: clone };
	const source = target === 'json' ? JSON.stringify(envelope, null, 2) : markdownEnvelope(envelope);
	const converted = { ...clone, format: target, source };
	assertViewShape(converted);
	return converted;
}

export function createNodeView(kind: DiagramKind, nodeLabel: string): NodeView {
	const spec = diagramKind(kind)!;
	const title = `${nodeLabel} · ${spec.label}`;
	return {
		id: `view-${crypto.randomUUID()}`,
		kind,
		title,
		format: 'md',
		source: viewAsMarkdown({ title, source: TEMPLATES[kind] })
	};
}

export function mermaidSource(view: Pick<NodeView, 'format' | 'source' | 'kind'>): string {
	const envelope = readEnvelope(view);
	if (!envelope) {
		if (view.source.length > MAX_AUTHORED_SOURCE_LENGTH) {
			throw new Error('Authored node view source exceeds 20,000 characters.');
		}
		return authoredMermaidSource(view);
	}
	if ('id' in view || 'title' in view) {
		assertViewShape(view);
		return authoredMermaidSource(originalView(view));
	}
	const original = originalView(envelope.view);
	if (original !== envelope.view) throw new Error('Nested node view wrappers are not supported.');
	if (view.kind !== original.kind)
		throw new Error('Node view kind does not match its canonical payload.');
	return authoredMermaidSource(original);
}

export function viewAsMarkdown(view: { title: string; source: string }): string {
	const body = view.source.includes('```')
		? mermaidSource({ ...view, format: 'md', kind: 'flowchart' })
		: view.source.trim();
	return `# ${view.title}\n\n${codeFence('mermaid', body)}`;
}

export function viewAsJson(view: Pick<NodeView, 'kind' | 'title' | 'format' | 'source'>): string {
	return JSON.stringify(
		{
			kind: view.kind,
			title: view.title,
			source: mermaidSource(view)
		},
		null,
		2
	);
}

export function kindGroups(): { group: string; kinds: (typeof DIAGRAM_KINDS)[number][] }[] {
	const groups: { group: string; kinds: (typeof DIAGRAM_KINDS)[number][] }[] = [];
	for (const kind of DIAGRAM_KINDS) {
		const found = groups.find((item) => item.group === kind.group);
		if (found) found.kinds.push(kind);
		else groups.push({ group: kind.group, kinds: [kind] });
	}
	return groups;
}
