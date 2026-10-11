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

it('keeps all MCP view links on the configured deployment origin', () => {
	for (const tool of ['graph_query', 'graph_build_view', 'graph_create_portable_view']) {
		const result = runGraphTool(
			defaultGraph,
			defaultInventory,
			tool,
			{},
			'https://pilot.example'
		) as {
			url?: string;
			viewUrl?: string;
		};
		expect(new URL(result.url ?? result.viewUrl!).origin).toBe('https://pilot.example');
	}
});
