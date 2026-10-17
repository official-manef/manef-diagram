import { expect, it } from 'vitest';
import {
	addContext,
	addDomainPlan,
	connectService,
	createDemoState,
	filterDemoNodes,
	installApp,
	linkDemoNodes,
	replaceDemoGraph,
	runDemoWorkflow,
	simulateTool,
	uninstallApp
} from './logic';
import { restoreWorkspaceSnapshot } from './storage';

it('keeps a demo install inside one workspace graph', () => {
	const start = createDemoState('Product studio');
	const installed = installApp(start, 'hermes');
	expect(installed.apps).toEqual(['hermes']);
	expect(installed.graph.nodes.some((node) => node.id === 'app-hermes')).toBe(true);
	expect(
		installed.graph.edges.some((edge) => edge.target === 'app-hermes' && edge.source === 'mso')
	).toBe(true);
	expect(installApp(installed, 'n8n').apps).toEqual(['hermes']);
	const removed = uninstallApp(installed, 'hermes');
	expect(removed.apps).toEqual([]);
	expect(removed.graph.nodes.some((node) => node.id === 'app-hermes')).toBe(false);
});

it('does not leak a demo install into a second workspace', () => {
	const studio = installApp(createDemoState('Product studio'), 'openclaw');
	const sandbox = createDemoState('Sandbox');
	expect(sandbox.apps).toEqual([]);
	expect(studio.apps).toEqual(['openclaw']);
});

it('marks a sample connection without calling a provider', () => {
	const next = connectService(createDemoState(), 'workos', true);
	expect(next.connections.workos).toBe(true);
	expect(next.graph.nodes.some((node) => node.id === 'workos')).toBe(true);
});

it('adds context onto the diagram node and simulates tools locally', () => {
	const next = addContext(createDemoState(), 'Release note', 'Demo only');
	expect(
		next.graph.edges.some((edge) => edge.label === 'holds context' && edge.source === 'diagram')
	).toBe(true);
	const status = simulateTool(next, 'graph_status', {});
	expect(status).toMatchObject({ simulation: true, persisted: false });
	expect(() => simulateTool(next, 'graph_status', [])).toThrow(/JSON object/);
	expect(() => simulateTool(next, 'missing', {})).toThrow(/Unknown tool/);
});

it('rejects a self-link and keeps an installed app when the demo graph is replaced', () => {
	const installed = installApp(createDemoState(), 'hermes');
	expect(linkDemoNodes(installed, 'mso', 'mso', 'loop')).toBe(installed);
	const replaced = replaceDemoGraph(installed, {
		graph: {
			nodes: [{ id: 'mso', label: 'MSO', kind: 'product', x: 10, y: 10 }],
			edges: []
		}
	});
	expect(replaced.graph.nodes.some((node) => node.id === 'app-hermes')).toBe(true);
	expect(replaced.apps).toEqual(['hermes']);
	const web = filterDemoNodes(installed.graph.nodes, '', { platform: ['platform:web'] });
	expect(web.every((node) => node.tags.includes('platform:web'))).toBe(true);
	expect(web.length).toBeGreaterThan(0);
	expect(() => replaceDemoGraph(installed, { graph: { nodes: [], edges: [] } })).not.toThrow();
	expect(() =>
		replaceDemoGraph(installed, {
			graph: {
				nodes: Array.from({ length: 41 }, (_, index) => ({ id: `n${index}`, label: 'N' })),
				edges: []
			}
		})
	).toThrow(/demo limit/);
});

it('keeps simulated additions valid after an import removes the default anchor nodes', () => {
	let state = replaceDemoGraph(createDemoState(), { graph: { nodes: [], edges: [] } });
	state = installApp(state, 'hermes');
	state = addContext(state, 'Notes', 'Imported map');
	state = runDemoWorkflow(state);
	state = addDomainPlan(state, 'demo.example.test');
	const ids = new Set(state.graph.nodes.map((node) => node.id));
	for (const edge of state.graph.edges) {
		expect(ids.has(edge.source)).toBe(true);
		expect(ids.has(edge.target)).toBe(true);
	}
	// The state remains restorable and usable by the shared graph tools.
	expect(
		restoreWorkspaceSnapshot({ active: state.workspace, workspaces: { [state.workspace]: state } })
	).not.toBeNull();
	expect(simulateTool(state, 'graph_status', {})).toMatchObject({ simulation: true });
	expect(state.graph.nodes).toHaveLength(4);
	expect(state.graph.edges).toEqual([]);
});

it('does not duplicate imported identifiers when creating context, runs, or domain plans', () => {
	let state = replaceDemoGraph(createDemoState(), {
		graph: {
			nodes: ['ctx-4', 'memory-run-1', 'domain-1'].map((id) => ({ id, label: id })),
			edges: []
		}
	});
	state = addContext(state, 'Fresh context', 'Notes');
	state = runDemoWorkflow(state);
	state = addDomainPlan(state, 'demo.example.test');
	expect(state.graph.nodes.map((node) => node.id)).toContain('ctx-4-1');
	expect(state.runs[0].id).toBe('run-2');
	expect(state.domains[0].id).toBe('domain-1-1');
	expect(new Set(state.graph.nodes.map((node) => node.id)).size).toBe(state.graph.nodes.length);
});

it('reuses an imported app node instead of appending a duplicate on install', () => {
	const imported = replaceDemoGraph(createDemoState(), {
		graph: { nodes: [{ id: 'app-hermes', label: 'Hermes' }], edges: [] }
	});
	const installed = installApp(imported, 'hermes');
	expect(installed.apps).toEqual(['hermes']);
	expect(installed.graph.nodes.filter((node) => node.id === 'app-hermes')).toHaveLength(1);
});

it('keeps generated edge IDs unique when endpoint names contain hyphens', () => {
	let state = replaceDemoGraph(createDemoState(), {
		graph: {
			nodes: ['a-b', 'c', 'a', 'b-c'].map((id) => ({ id, label: id })),
			edges: []
		}
	});
	state = linkDemoNodes(state, 'a-b', 'c', 'First');
	state = linkDemoNodes(state, 'a', 'b-c', 'Second');
	expect(state.graph.edges).toHaveLength(2);
	expect(new Set(state.graph.edges.map((edge) => edge.id)).size).toBe(2);
});

it('rejects duplicate edge IDs in imported graphs', () => {
	expect(() =>
		replaceDemoGraph(createDemoState(), {
			graph: {
				nodes: ['a', 'b', 'c'].map((id) => ({ id, label: id })),
				edges: [
					{ id: 'duplicate', source: 'a', target: 'b', label: 'First' },
					{ id: 'duplicate', source: 'b', target: 'c', label: 'Second' }
				]
			}
		})
	).toThrow(/Edge ids must be unique/);
});

it('avoids edge ID collisions when an import restores installed app nodes', () => {
	const installed = installApp(createDemoState(), 'hermes');
	const replaced = replaceDemoGraph(installed, {
		graph: {
			nodes: ['mso', 'a'].map((id) => ({ id, label: id })),
			edges: [{ id: 'edge-hermes', source: 'mso', target: 'a', label: 'Existing' }]
		}
	});
	expect(replaced.graph.edges.map((edge) => edge.id)).toEqual(['edge-hermes', 'edge-hermes-1']);
});
