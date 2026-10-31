import { describe, expect, it } from 'vitest';
import { defaultGraph } from '../config/default-graph';
import { DIAGRAM_KINDS, convertNodeView, diagramKind, isNodeView } from './diagram-views';
import { compileGraphSource, compileNodeView } from './diagram-compile';
import type { ArchitectureGraph } from '../types';

const emptyGraph: ArchitectureGraph = { schemaVersion: 1, nodes: [], edges: [] };

function graphWith(labels: string[]): ArchitectureGraph {
	return {
		schemaVersion: 1,
		nodes: labels.map((label, index) => ({
			id: `n${index}`,
			label,
			level: Math.min(index, 2),
			tags: [],
			inputs: [{ id: 'in', label: 'Consumes' }],
			outputs: [{ id: 'out', label: 'Provides' }]
		})),
		edges:
			labels.length > 1
				? [
						{
							id: 'e0',
							source: 'n0',
							sourcePort: 'out',
							target: 'n1',
							targetPort: 'in',
							label: 'a "quoted" | label, with [brackets]'
						}
					]
				: []
	};
}

describe('diagram compilers', () => {
	it('compiles the demo graph into every diagram kind with its Mermaid keyword', () => {
		for (const kind of DIAGRAM_KINDS) {
			const source = compileGraphSource(defaultGraph, kind.id, 'Manef demo');
			expect(
				source.startsWith(`${kind.keyword}\n`) || source.startsWith(`${kind.keyword} `),
				`${kind.id} should start with ${kind.keyword}`
			).toBe(true);
			expect(source.length).toBeLessThanOrEqual(20_000);
		}
	});

	it('compiles deterministically from the same graph', () => {
		for (const kind of DIAGRAM_KINDS) {
			const first = compileGraphSource(defaultGraph, kind.id, 'Manef demo');
			const second = compileGraphSource(defaultGraph, kind.id, 'Manef demo');
			expect(second, `${kind.id} must be deterministic`).toBe(first);
		}
	});

	it('restructures real graph content, not canned text', () => {
		const flowchart = compileGraphSource(defaultGraph, 'flowchart', 'demo');
		const node = defaultGraph.nodes[0];
		expect(flowchart).toContain(`["${node.label}"]`);
		const edge = defaultGraph.edges.find((item) => item.label);
		expect(flowchart).toContain(`--> |"${edge!.label}"|`);
		const sequence = compileGraphSource(defaultGraph, 'sequence', 'demo');
		expect(sequence).toContain(`participant ${node.id.replace(/[^A-Za-z0-9_]/g, '')}`);
		const c4 = compileGraphSource(defaultGraph, 'c4', 'demo');
		expect(c4).toContain(`"${node.label}"`);
	});

	it('escapes quotes and keeps multi-line labels single-line', () => {
		const graph = graphWith(['He said "hi"', 'Plain [brackets]']);
		for (const kind of DIAGRAM_KINDS) {
			const source = compileGraphSource(graph, kind.id, 'escapes');
			expect(
				source.split('\n').every((line) => !line.includes('\t')),
				`${kind.id} kept a tab`
			).toBe(true);
		}
		const flowchart = compileGraphSource(graph, 'flowchart', 'escapes');
		expect(flowchart).toContain('n0["He said hi"]');
		expect(flowchart).toContain('n0 --> |"a quoted  label, with [brackets]"| n1');
	});

	it('compiles a valid node view from the graph and stays convertible', () => {
		const view = compileNodeView(defaultGraph, 'flowchart', 'Public directory');
		expect(isNodeView(view)).toBe(true);
		expect(view.title).toBe('Public directory · Flowchart');
		const json = convertNodeView(view, 'json');
		expect(isNodeView(json)).toBe(true);
		const roundTrip = convertNodeView(json, 'md');
		expect(roundTrip.source).toBe(view.source);
	});

	it('falls back to the template only for an empty graph', () => {
		const view = compileNodeView(emptyGraph, 'sequence', 'Nothing yet');
		expect(isNodeView(view)).toBe(true);
		expect(view.source).toContain('sequenceDiagram');
		expect(view.source).toContain('actor User');
	});

	it('stays inside the compiled bounds for oversized graphs', () => {
		const many: ArchitectureGraph = {
			schemaVersion: 1,
			nodes: Array.from({ length: 120 }, (_, index) => ({
				id: `node-${index}`,
				label: `Service ${index}`,
				level: index % 4,
				tags: [],
				inputs: [{ id: 'in', label: 'In' }],
				outputs: [{ id: 'out', label: 'Out' }]
			})),
			edges: Array.from({ length: 400 }, (_, index) => ({
				id: `edge-${index}`,
				source: `node-${index % 120}`,
				sourcePort: 'out',
				target: `node-${(index + 1) % 120}`,
				targetPort: 'in',
				label: `step ${index}`
			}))
		};
		for (const kind of DIAGRAM_KINDS) {
			const source = compileGraphSource(many, kind.id, 'Big map');
			expect(source.length, `${kind.id} exceeded the size bound`).toBeLessThanOrEqual(20_000);
		}
		expect(
			compileGraphSource(many, 'flowchart', 'Big map')
				.split('\n')
				.filter((line) => line.includes('-->')).length
		).toBeLessThanOrEqual(240);
	});

	it('derives chart values from graph structure', () => {
		const pie = compileGraphSource(defaultGraph, 'pie', 'demo');
		const firstNode = defaultGraph.nodes[0];
		const outDegree = defaultGraph.edges.filter((edge) => edge.source === firstNode.id).length;
		if (outDegree > 0) expect(pie).toContain(`"${firstNode.label}" : ${outDegree}`);
		const sankey = compileGraphSource(defaultGraph, 'sankey', 'demo');
		const edge = defaultGraph.edges[0];
		const sourceLabel = defaultGraph.nodes.find((node) => node.id === edge.source)!.label;
		const targetLabel = defaultGraph.nodes.find((node) => node.id === edge.target)!.label;
		expect(sankey).toContain(`${sourceLabel},${targetLabel},1`);
	});

	it('knows only real diagram kinds', () => {
		expect(diagramKind('flowchart')?.label).toBe('Flowchart');
		expect(diagramKind('nonsense')).toBeUndefined();
	});
});
