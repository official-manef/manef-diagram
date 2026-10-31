import type { ArchitectureGraph, NodeView } from '../types';
import { createNodeView, diagramKind, viewAsMarkdown } from './diagram-views';
import type { DiagramKind } from './diagram-views';

/**
 * Compiled diagram views.
 *
 * Every diagram kind gets a compiler that restructures the actual graph — its
 * nodes, edges, levels, ports and statuses — into that kind's Mermaid source.
 * Nothing here invents entities: labels, connections and groupings all come
 * from the document, deterministically, so one demo graph demonstrates every
 * kind. Templates remain only for an empty graph.
 */

const MAX_COMPILED_NODES = 80;
const MAX_COMPILED_EDGES = 240;
const MAX_SOURCE_CHARS = 20_000;
const STATUS_SCORE: Record<string, number> = { active: 5, proposed: 3, private: 2 };
const STATUS_RISK: Record<string, string> = { active: 'low', proposed: 'medium', private: 'high' };

type Node = ArchitectureGraph['nodes'][number];

/** Collapse whitespace and drop characters that break most Mermaid literals. */
function clean(label: string): string {
	return label
		.replace(/[\r\n\t]+/g, ' ')
		.replace(/["`|]/g, '')
		.trim();
}

/** plain(): also drop characters reserved outside quoted strings. */
function plain(label: string): string {
	return clean(label)
		.replace(/[[\](){}:;,]/g, '')
		.trim();
}

function csvField(label: string): string {
	const value = clean(label);
	return /[",]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Unique identifier tokens safe for Mermaid ids. */
function tokens(ids: readonly string[]): Map<string, string> {
	const used = new Set<string>();
	const map = new Map<string, string>();
	for (const id of ids) {
		let token = id.replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
		if (!token || /^[0-9]/.test(token)) token = `n${token || 'node'}`;
		let unique = token;
		let suffix = 2;
		while (used.has(unique)) unique = `${token}_${suffix++}`;
		used.add(unique);
		map.set(id, unique);
	}
	return map;
}

type CompileContext = {
	nodes: Node[];
	edges: ArchitectureGraph['edges'];
	ids: Map<string, string>;
	title: string;
};

function level(node: Node): number {
	return node.level ?? 3;
}

/** Parent = source of the first edge from a strictly earlier level. */
function parentMap({ nodes, edges }: CompileContext): Map<string, string> {
	const byId = new Map(nodes.map((node) => [node.id, node]));
	const parents = new Map<string, string>();
	for (const edge of edges) {
		const source = byId.get(edge.source);
		const target = byId.get(edge.target);
		if (!source || !target || parents.has(target.id)) continue;
		if (level(source) < level(target)) parents.set(target.id, source.id);
	}
	return parents;
}

/** Breadth-first hierarchy lines rooted at the level-0 (or titled) node. */
function hierarchyLines(
	context: CompileContext,
	rootLine: string,
	format: (node: Node) => string = (node) => plain(node.label) || node.id
): string[] {
	const parents = parentMap(context);
	const lines: string[] = [rootLine];
	let depth = 1;
	let frontier = context.nodes.filter((node) => !parents.has(node.id));
	const emitted = new Set(frontier.map((node) => node.id));
	while (frontier.length > 0 && depth <= 6) {
		const next: Node[] = [];
		for (const node of frontier) {
			lines.push(`${'  '.repeat(depth)}${format(node)}`);
		}
		for (const node of frontier) {
			for (const child of context.nodes) {
				if (parents.get(child.id) === node.id && !emitted.has(child.id)) {
					emitted.add(child.id);
					next.push(child);
				}
			}
		}
		frontier = next;
		depth += 1;
	}
	return lines;
}

function outDegrees({ edges, nodes }: CompileContext): Map<string, number> {
	const counts = new Map<string, number>(nodes.map((node) => [node.id, 0]));
	for (const edge of edges) {
		if (counts.has(edge.source)) counts.set(edge.source, counts.get(edge.source)! + 1);
	}
	return counts;
}

function levelStages(context: CompileContext): { stage: string; nodes: Node[] }[] {
	const stages = new Map<number, Node[]>();
	for (const node of context.nodes) {
		const key = level(node);
		if (!stages.has(key)) stages.set(key, []);
		stages.get(key)!.push(node);
	}
	return [...stages.entries()]
		.sort(([a], [b]) => a - b)
		.map(([key, nodes]) => ({ stage: `Stage ${key + 1}`, nodes }));
}

const compilers: Record<DiagramKind, (context: CompileContext) => string> = {
	flowchart: ({ nodes, edges, ids }) => {
		const lines = ['flowchart LR'];
		for (const node of nodes) {
			lines.push(`  ${ids.get(node.id)}["${clean(node.label) || node.id}"]`);
		}
		for (const edge of edges) {
			const label = clean(edge.label ?? '');
			lines.push(
				label
					? `  ${ids.get(edge.source)} --> |"${label}"| ${ids.get(edge.target)}`
					: `  ${ids.get(edge.source)} --> ${ids.get(edge.target)}`
			);
		}
		const restricted = nodes.filter((node) => node.status === 'private');
		if (restricted.length > 0) {
			lines.push('  classDef private stroke-dasharray: 5 5');
			lines.push(`  class ${restricted.map((node) => ids.get(node.id)).join(',')} private`);
		}
		return lines.join('\n');
	},
	sequence: ({ nodes, edges, ids }) => {
		const lines = ['sequenceDiagram'];
		for (const node of nodes) {
			lines.push(`  participant ${ids.get(node.id)} as ${plain(node.label) || node.id}`);
		}
		for (const edge of edges) {
			lines.push(
				`  ${ids.get(edge.source)}->>${ids.get(edge.target)}: ${plain(edge.label ?? '') || 'calls'}`
			);
		}
		return lines.join('\n');
	},
	state: ({ nodes, edges, ids }) => {
		const lines = ['stateDiagram-v2'];
		for (const node of nodes) {
			lines.push(`  state "${plain(node.label) || node.id}" as ${ids.get(node.id)}`);
		}
		const first = nodes.find((node) => level(node) === 0) ?? nodes[0];
		if (first) lines.push(`  [*] --> ${ids.get(first.id)}`);
		for (const edge of edges) {
			const label = plain(edge.label ?? '');
			lines.push(
				label
					? `  ${ids.get(edge.source)} --> ${ids.get(edge.target)}: ${label}`
					: `  ${ids.get(edge.source)} --> ${ids.get(edge.target)}`
			);
		}
		for (const node of nodes
			.filter((item) => !edges.some((edge) => edge.source === item.id))
			.slice(0, 5)) {
			lines.push(`  ${ids.get(node.id)} --> [*]`);
		}
		return lines.join('\n');
	},
	journey: (context) => {
		const lines = ['journey', `  title ${plain(context.title) || 'Diagram'}`];
		for (const { stage, nodes } of levelStages(context)) {
			lines.push(`  section ${stage}`);
			for (const node of nodes) {
				const score = STATUS_SCORE[node.status ?? 'active'] ?? 4;
				lines.push(`    ${plain(node.label) || node.id}: ${score}: Editor`);
			}
		}
		return lines.join('\n');
	},
	class: ({ nodes, edges, ids }) => {
		const lines = ['classDiagram'];
		for (const node of nodes) {
			const members = [
				...(node.inputs ?? []).map((port) => `+${plain(port.label).replace(/\s+/g, '')}()`),
				...(node.outputs ?? []).map((port) => `+${plain(port.label).replace(/\s+/g, '')}()`)
			].filter((member) => member.length > 2);
			if (members.length === 0) {
				lines.push(`  class ${ids.get(node.id)}`);
				continue;
			}
			lines.push(`  class ${ids.get(node.id)} {`);
			for (const member of members) lines.push(`    ${member}`);
			lines.push('  }');
		}
		for (const edge of edges) {
			const label = plain(edge.label ?? '');
			lines.push(
				label
					? `  ${ids.get(edge.source)} --> ${ids.get(edge.target)} : ${label}`
					: `  ${ids.get(edge.source)} --> ${ids.get(edge.target)}`
			);
		}
		return lines.join('\n');
	},
	er: ({ nodes, edges, ids }) => {
		const lines = ['erDiagram'];
		for (const node of nodes) {
			const attributes = [...(node.inputs ?? []), ...(node.outputs ?? [])]
				.map((port) => plain(port.label).replace(/\s+/g, '_'))
				.filter(Boolean);
			if (attributes.length === 0) continue;
			lines.push(`  ${ids.get(node.id)} {`);
			for (const attribute of attributes.slice(0, 8)) lines.push(`    string ${attribute}`);
			lines.push('  }');
		}
		for (const edge of edges) {
			lines.push(
				`  ${ids.get(edge.source)} ||--o{ ${ids.get(edge.target)} : ${plain(edge.label ?? '') || 'connects'}`
			);
		}
		return lines.join('\n');
	},
	c4: ({ nodes, edges, ids, title }) => {
		const lines = ['C4Context', `  title ${plain(title) || 'System context'}`];
		for (const node of nodes) {
			const call = node.tags.includes('person') ? 'Person' : 'System';
			lines.push(
				`  ${call}(${ids.get(node.id)}, "${clean(node.label) || node.id}", "${clean(node.subtitle ?? '')}")`
			);
		}
		for (const edge of edges) {
			lines.push(
				`  Rel(${ids.get(edge.source)}, ${ids.get(edge.target)}, "${plain(edge.label ?? '') || 'connects'}")`
			);
		}
		return lines.join('\n');
	},
	block: ({ nodes, edges, ids }) => {
		const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(nodes.length))));
		const lines = ['block-beta', `  columns ${columns}`];
		for (const node of nodes) {
			lines.push(`  ${ids.get(node.id)}["${clean(node.label) || node.id}"]`);
		}
		for (const edge of edges) {
			lines.push(`  ${ids.get(edge.source)} --> ${ids.get(edge.target)}`);
		}
		return lines.join('\n');
	},
	architecture: ({ nodes, edges, ids }) => {
		const lines = ['architecture-beta'];
		const groups = new Map<number, string>();
		for (const node of nodes) {
			const key = level(node);
			if (!groups.has(key)) {
				const name = `stage${key}`;
				groups.set(key, name);
				lines.push(`  group ${name}(cloud)[Stage ${key + 1}]`);
			}
			lines.push(
				`  service ${ids.get(node.id)!.toLowerCase()}(server)["${clean(node.label) || node.id}"] in ${groups.get(key)}`
			);
		}
		for (const edge of edges) {
			lines.push(
				`  ${ids.get(edge.source)!.toLowerCase()}:R --> L:${ids.get(edge.target)!.toLowerCase()}`
			);
		}
		return lines.join('\n');
	},
	packet: ({ nodes, ids }) => {
		const lines = ['packet-beta'];
		let low = 0;
		for (const node of nodes.slice(0, 4)) {
			lines.push(`  ${low}-${low + 7}: "${clean(node.label) || ids.get(node.id)}"`);
			low += 8;
		}
		return lines.join('\n');
	},
	mindmap: (context) => {
		const root = context.nodes.find((node) => level(node) === 0);
		const rest = context.nodes.filter((node) => node.id !== root?.id);
		const rootLabel = root
			? `root((${plain(root.label) || root.id}))`
			: `root((${plain(context.title) || 'Diagram'}))`;
		return ['mindmap', ...hierarchyLines({ ...context, nodes: rest }, rootLabel)].join('\n');
	},
	tree: (context) => {
		const root = context.nodes.find((node) => level(node) === 0);
		const rest = context.nodes.filter((node) => node.id !== root?.id);
		const rootLine = plain(root?.label ?? '') || plain(context.title) || 'Diagram';
		return ['treeView-beta', ...hierarchyLines({ ...context, nodes: rest }, rootLine)].join('\n');
	},
	requirement: ({ nodes, edges, ids }) => {
		const lines = ['requirementDiagram'];
		for (const [index, node] of nodes.slice(0, 40).entries()) {
			const risk = STATUS_RISK[node.status ?? 'active'] ?? 'low';
			lines.push(`  requirement ${ids.get(node.id)}_req {`);
			lines.push(`    id: "${index + 1}"`);
			lines.push(`    text: "${clean(node.subtitle ?? '') || clean(node.label) || node.id}"`);
			lines.push(`    risk: ${risk}`);
			lines.push('    verifymethod: analysis');
			lines.push('  }');
			lines.push(`  element ${ids.get(node.id)}_el {`);
			lines.push('    type: component');
			lines.push('  }');
		}
		for (const edge of edges) {
			lines.push(`  ${ids.get(edge.source)}_el - satisfies -> ${ids.get(edge.target)}_req`);
		}
		return lines.join('\n');
	},
	gantt: (context) => {
		const lines = [
			'gantt',
			`  title ${plain(context.title) || 'Roadmap'}`,
			'  dateFormat YYYY-MM-DD'
		];
		let previous: string | undefined;
		let index = 0;
		for (const { stage, nodes } of levelStages(context)) {
			lines.push(`  section ${stage}`);
			for (const node of nodes) {
				const token = `t${index++}`;
				lines.push(
					previous
						? `    ${plain(node.label) || node.id} :${token}, after ${previous}, 7d`
						: `    ${plain(node.label) || node.id} :${token}, 2026-01-01, 7d`
				);
				previous = token;
			}
		}
		return lines.join('\n');
	},
	timeline: (context) => {
		const lines = ['timeline', `  title ${plain(context.title) || 'Timeline'}`];
		for (const { stage, nodes } of levelStages(context)) {
			lines.push(`  ${stage}${nodes.map((node) => ` : ${plain(node.label) || node.id}`).join('')}`);
		}
		return lines.join('\n');
	},
	git: ({ nodes, ids }) => {
		const lines = ['gitGraph'];
		for (const node of nodes.filter((item) => level(item) === 0)) {
			lines.push(`  commit id: "${plain(node.label) || node.id}"`);
		}
		for (const node of nodes.filter((item) => level(item) === 1).slice(0, 6)) {
			const branch = ids.get(node.id)!.toLowerCase();
			lines.push(`  branch ${branch}`);
			lines.push(`  checkout ${branch}`);
			lines.push(`  commit id: "${plain(node.label) || node.id}"`);
			lines.push('  checkout main');
			lines.push(`  merge ${branch}`);
		}
		for (const node of nodes.filter((item) => level(item) >= 2)) {
			lines.push(`  commit id: "${plain(node.label) || node.id}"`);
		}
		return lines.join('\n');
	},
	kanban: ({ nodes }) => {
		const lines = ['kanban'];
		const columns = new Map<string, string[]>([
			['Proposed', []],
			['Active', []],
			['Private', []]
		]);
		for (const node of nodes) {
			const column =
				node.status === 'proposed' ? 'Proposed' : node.status === 'private' ? 'Private' : 'Active';
			columns.get(column)!.push(plain(node.label) || node.id);
		}
		for (const [column, cards] of columns) {
			if (cards.length === 0) continue;
			lines.push(`  ${column}`);
			for (const card of cards) lines.push(`    ${card}`);
		}
		return lines.join('\n');
	},
	pie: (context) => {
		const counts = outDegrees(context);
		const lines = [`pie title ${plain(context.title) || 'Connections'}`];
		for (const node of context.nodes) {
			const value = counts.get(node.id)!;
			if (value > 0) lines.push(`  "${clean(node.label) || node.id}" : ${value}`);
		}
		if (lines.length === 1) {
			for (const { stage, nodes } of levelStages(context)) {
				lines.push(`  "${stage}" : ${nodes.length}`);
			}
		}
		return lines.join('\n');
	},
	quadrant: (context) => {
		const counts = outDegrees(context);
		const max = Math.max(1, ...counts.values());
		const maxLevel = Math.max(0, ...context.nodes.map(level));
		const lines = [
			'quadrantChart',
			'  title Reach vs connections',
			'  x-axis Narrow --> Wide',
			'  y-axis Few --> Many',
			'  quadrant-1 Scale',
			'  quadrant-2 Promote',
			'  quadrant-3 Watch',
			'  quadrant-4 Retire'
		];
		for (const node of context.nodes.slice(0, 30)) {
			// Mermaid's quadrant lexer rejects 1.00-style saturated values; clamp inside the range.
			const x = Math.min(0.99, maxLevel === 0 ? 1 : 1 - level(node) / (maxLevel + 1));
			const y = Math.min(0.99, (counts.get(node.id) ?? 0) / max);
			lines.push(
				`  "${plain(node.label) || context.ids.get(node.id)}": [${x.toFixed(2)}, ${y.toFixed(2)}]`
			);
		}
		return lines.join('\n');
	},
	xy: (context) => {
		const counts = outDegrees(context);
		const selected = context.nodes.slice(0, 12);
		const values = selected.map((node) => counts.get(node.id) ?? 0);
		const max = Math.max(10, ...values);
		return [
			'xychart-beta',
			`  title "${plain(context.title) || 'Connections'}"`,
			`  x-axis [${selected.map((node) => context.ids.get(node.id)).join(', ')}]`,
			`  y-axis "outgoing" 0 --> ${max}`,
			`  bar [${values.join(', ')}]`
		].join('\n');
	},
	radar: (context) => {
		const counts = outDegrees(context);
		const selected = context.nodes.slice(0, 12);
		return [
			'radar-beta',
			`  axis ${selected.map((node) => context.ids.get(node.id)).join(', ')}`,
			`  curve connections{${selected.map((node) => counts.get(node.id) ?? 0).join(', ')}}`
		].join('\n');
	},
	sankey: ({ nodes, edges }) => {
		const byId = new Map(nodes.map((node) => [node.id, node]));
		const lines: string[] = [];
		for (const edge of edges.slice(0, 120)) {
			const source = byId.get(edge.source);
			const target = byId.get(edge.target);
			if (!source || !target) continue;
			lines.push(`${csvField(source.label)},${csvField(target.label)},1`);
		}
		return ['sankey-beta', ...lines].join('\n');
	},
	treemap: (context) => {
		return [
			'treemap-beta',
			...hierarchyLines(
				context,
				`"${plain(context.title) || 'Map'}"`,
				(node) => `"${plain(node.label) || node.id}": 1`
			)
		].join('\n');
	},
	ishikawa: ({ nodes, edges, ids }) => {
		const effect = nodes.find((node) => level(node) === 0) ?? nodes[0];
		const lines: string[] = ['ishikawa-beta', `  ${plain(effect?.label ?? '') || 'Effect'}`];
		for (const branch of nodes.filter((node) => node.id !== effect?.id && level(node) === 1)) {
			lines.push(`    ${plain(branch.label) || ids.get(branch.id)}`);
			for (const edge of edges.filter((item) => item.source === branch.id)) {
				const cause = nodes.find((node) => node.id === edge.target);
				if (cause) lines.push(`      ${plain(cause.label) || ids.get(cause.id)}`);
			}
		}
		return lines.join('\n');
	}
};

function buildContext(graph: ArchitectureGraph, title: string): CompileContext {
	const nodes = graph.nodes.slice(0, MAX_COMPILED_NODES);
	const nodeIds = new Set(nodes.map((node) => node.id));
	const edges = graph.edges
		.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
		.slice(0, MAX_COMPILED_EDGES);
	return { nodes, edges, ids: tokens(nodes.map((node) => node.id)), title };
}

/** Restructure the graph into the chosen kind's Mermaid source. */
export function compileGraphSource(
	graph: ArchitectureGraph,
	kind: DiagramKind,
	title: string
): string {
	const compiler = compilers[kind];
	if (!compiler) throw new Error(`No compiler for diagram kind ${kind}.`);
	const source = compiler(buildContext(graph, title)).trim();
	if (source.length > MAX_SOURCE_CHARS)
		throw new Error('Compiled view exceeds the source size limit.');
	return source;
}

/** A view compiled from the graph; templates only answer an empty graph. */
export function compileNodeView(
	graph: ArchitectureGraph,
	kind: DiagramKind,
	label: string
): NodeView {
	if (graph.nodes.length === 0) return createNodeView(kind, label);
	const spec = diagramKind(kind)!;
	const title = `${label} · ${spec.label}`;
	const source = compileGraphSource(graph, kind, label);
	return {
		id: `view-${crypto.randomUUID()}`,
		kind,
		title,
		format: 'md',
		source: viewAsMarkdown({ title, source })
	};
}
