import { describe, expect, it } from 'vitest';
import { defaultGraph } from '../config/default-graph';
import {
	appendPort,
	createNode,
	patchNode,
	withEdgePatch,
	withoutNodes,
	withoutPort
} from './edit';
import { validateGraph } from './graph';
import type { ArchitectureGraph, ArchitectureNode } from '../types';

function node(id: string): ArchitectureNode {
	return {
		id,
		label: id,
		tags: [],
		inputs: [{ id: 'in', label: 'Input' }],
		outputs: [{ id: 'out', label: 'Output' }]
	};
}

function removalFixture(): ArchitectureGraph {
	const removed = node('a');
	const kept = node('b');
	removed.child = { schemaVersion: 1, nodes: [node('removed-component')], edges: [] };
	removed.views = [
		{
			id: 'removed-view',
			kind: 'flowchart',
			title: 'Removed view',
			format: 'md',
			source: 'flowchart LR\nA-->B'
		}
	];
	kept.child = Object.assign(
		{ schemaVersion: 1 as const, nodes: [node('a')], edges: [] },
		{ metadata: { nested: 'preserved' } }
	);
	kept.views = [
		{
			id: 'kept-view',
			kind: 'flowchart',
			title: 'Kept view',
			format: 'md',
			source: 'flowchart LR\nA-->B'
		}
	];
	Object.assign(kept, { extension: { metadata: ['keep', true] } });
	Object.assign(kept.inputs[0], { metadata: { port: true } });
	Object.assign(kept.views[0], { metadata: { view: true } });
	const connections = [
		['incoming', 'b', 'a'],
		['outgoing', 'a', 'c'],
		['self', 'a', 'a'],
		['keep', 'b', 'c'],
		['keep-other', 'b', 'd']
	].map(([id, source, target]) => ({ id, source, sourcePort: 'out', target, targetPort: 'in' }));
	Object.assign(connections[3], { metadata: { edge: ['preserved'] } });
	return Object.assign(
		{
			schemaVersion: 1 as const,
			nodes: [removed, kept, node('c'), node('d')],
			edges: connections
		},
		{ metadata: { document: ['preserved'] } }
	);
}

describe('diagram edits', () => {
	it('patches a node and adds a port without touching the others', () => {
		const renamed = patchNode(defaultGraph, 'manef', { label: 'MANEF group' });
		expect(renamed.nodes.find((node) => node.id === 'manef')?.label).toBe('MANEF group');
		expect(renamed.nodes).toHaveLength(defaultGraph.nodes.length);
		const withPort = appendPort(renamed, 'manef', 'outputs');
		expect(withPort.nodes.find((node) => node.id === 'manef')?.outputs.at(-1)?.id).toBe('out-2');
	});

	it('drops a port and the connections that used it', () => {
		const next = withoutPort(defaultGraph, 'manef', 'outputs', 'out');
		expect(
			next.nodes.find((node) => node.id === 'manef')?.outputs.some((port) => port.id === 'out')
		).toBe(false);
		expect(next.edges.some((edge) => edge.source === 'manef' && edge.sourcePort === 'out')).toBe(
			false
		);
		expect(next.edges.length).toBeLessThan(defaultGraph.edges.length);
	});

	it('adds a new port without reusing an ID after an earlier port was removed', () => {
		let graph = appendPort(defaultGraph, 'manef', 'outputs');
		graph = appendPort(graph, 'manef', 'outputs');
		graph = withoutPort(graph, 'manef', 'outputs', 'out-2');
		graph = appendPort(graph, 'manef', 'outputs');
		const ports = graph.nodes.find((node) => node.id === 'manef')!.outputs;
		expect(new Set(ports.map((port) => port.id)).size).toBe(ports.length);
		expect(ports.at(-1)?.id).toBe('out-4');
	});

	it('rejects a connection that already exists and accepts a free target', () => {
		const edge = defaultGraph.edges[0];
		expect(withEdgePatch(defaultGraph, edge, { label: 'renamed' })?.edges[0]?.label).toBe(
			'renamed'
		);
		const duplicate = defaultGraph.edges[1];
		expect(
			withEdgePatch(defaultGraph, duplicate, {
				source: edge.source,
				sourcePort: edge.sourcePort,
				target: edge.target,
				targetPort: edge.targetPort
			})
		).toBeNull();
	});

	it('names a new node without colliding', () => {
		const node = createNode(defaultGraph);
		expect(defaultGraph.nodes.some((item) => item.id === node.id)).toBe(false);
		expect(node.inputs).toHaveLength(1);
		expect(node.outputs).toHaveLength(1);
	});
	it('removes a node, its descendants and views, and every incoming, outgoing and self connection', () => {
		const graph = removalFixture();
		const before = JSON.stringify(graph);
		expect(validateGraph(graph)).toBe(true);
		const next = withoutNodes(graph, ['a']);
		expect(next.nodes.map((item) => item.id)).toEqual(['b', 'c', 'd']);
		expect(next.edges.map((edge) => edge.id)).toEqual(['keep', 'keep-other']);
		expect(JSON.stringify(next)).not.toContain('removed-component');
		expect(JSON.stringify(next)).not.toContain('removed-view');
		expect(next.nodes[0]).toBe(graph.nodes[1]);
		expect(next.nodes[0].child?.nodes[0].id).toBe('a');
		expect(next.edges[0]).toBe(graph.edges[3]);
		expect(next).toMatchObject({ metadata: { document: ['preserved'] } });
		expect(next.nodes[0]).toMatchObject({
			extension: { metadata: ['keep', true] },
			inputs: [{ metadata: { port: true } }],
			views: [{ metadata: { view: true } }],
			child: { metadata: { nested: 'preserved' } }
		});
		expect(next.edges[0]).toMatchObject({ metadata: { edge: ['preserved'] } });
		expect(validateGraph(next)).toBe(true);
		expect(JSON.stringify(graph)).toBe(before);
	});

	it('removes several selected nodes once even with repeated or unknown ids', () => {
		const graph = removalFixture();
		const ids = ['a', 'missing', 'c', 'a', 'c'];
		const next = withoutNodes(graph, ids);
		expect(next.nodes.map((item) => item.id)).toEqual(['b', 'd']);
		expect(next.edges.map((edge) => edge.id)).toEqual(['keep-other']);
		expect(validateGraph(next)).toBe(true);
		expect(withoutNodes(next, ids)).toBe(next);
		expect(ids).toEqual(['a', 'missing', 'c', 'a', 'c']);
		const empty = withoutNodes(next, ['b', 'd']);
		expect(empty.nodes).toEqual([]);
		expect(empty.edges).toEqual([]);
		expect(empty).toMatchObject({ metadata: { document: ['preserved'] } });
		expect(validateGraph(empty)).toBe(true);
	});

	it('keeps the original graph reference when no existing nodes are selected', () => {
		const graph = removalFixture();
		expect(withoutNodes(graph, [])).toBe(graph);
		expect(withoutNodes(graph, ['missing', 'missing', 'removed-component'])).toBe(graph);
	});
});
