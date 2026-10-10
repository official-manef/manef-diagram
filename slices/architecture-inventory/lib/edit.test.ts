import { describe, expect, it } from 'vitest';
import { defaultGraph } from '../config/default-graph';
import { appendPort, createNode, patchNode, withEdgePatch, withoutPort } from './edit';

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
});
