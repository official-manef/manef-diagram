import type { NodeView } from '../types';

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

export function isNodeView(value: unknown): value is NodeView {
	if (typeof value !== 'object' || value === null) return false;
	const view = value as Partial<NodeView>;
	return (
		typeof view.id === 'string' &&
		view.id.length > 0 &&
		view.id.length < 80 &&
		typeof view.kind === 'string' &&
		isDiagramKind(view.kind) &&
		typeof view.title === 'string' &&
		typeof view.source === 'string' &&
		view.source.length <= 20_000 &&
		(view.format === 'md' || view.format === 'json')
	);
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
	if (view.format === 'json') {
		const value: unknown = JSON.parse(view.source);
		if (
			typeof value === 'object' &&
			value !== null &&
			'source' in value &&
			typeof value.source === 'string'
		) {
			return value.source.trim();
		}
		throw new Error('JSON view needs a source string.');
	}
	const fenced = /```mermaid\s*([\s\S]*?)```/i.exec(view.source);
	if (fenced) return fenced[1].trim();
	return view.source.replace(/^#\s+.+\n+/, '').trim();
}

export function viewAsMarkdown(view: { title: string; source: string }): string {
	const body = view.source.includes('```')
		? mermaidSource({ ...view, format: 'md', kind: 'flowchart' })
		: view.source.trim();
	return `# ${view.title}\n\n\`\`\`mermaid\n${body}\n\`\`\`\n`;
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
