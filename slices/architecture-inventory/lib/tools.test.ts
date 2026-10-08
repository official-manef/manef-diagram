import { expect, it } from 'vitest';
import { defaultGraph, defaultInventory } from '../config/default-graph';
import { GRAPH_TOOL_NAMES, runGraphTool } from './tools';

it('runs the public graph tools from one contract', () => {
	expect(GRAPH_TOOL_NAMES).toHaveLength(10);
	const status = runGraphTool(defaultGraph, defaultInventory, 'graph_status', {});
	expect(status).toEqual({
		schemaVersion: 1,
		nodeCount: defaultGraph.nodes.length,
		edgeCount: defaultGraph.edges.length
	});
	const proposed = runGraphTool(defaultGraph, defaultInventory, 'graph_query', {
		status: 'proposed'
	}) as { nodes: { status?: string }[]; viewUrl: string };
	expect(proposed.nodes.length).toBeGreaterThan(0);
	expect(proposed.nodes.every((node) => node.status === 'proposed')).toBe(true);
	expect(new URL(proposed.viewUrl).pathname).toBe('/app');
	expect(() => runGraphTool(defaultGraph, defaultInventory, 'missing', {})).toThrow(/Unknown tool/);
	expect(() =>
		runGraphTool(defaultGraph, defaultInventory, 'graph_create_portable_view', { graph: {} })
	).toThrow(/contract/);
});
