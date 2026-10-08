import { expect, it } from 'vitest';
import {
	addContext,
	connectService,
	createDemoState,
	filterDemoNodes,
	installApp,
	linkDemoNodes,
	replaceDemoGraph,
	simulateTool,
	uninstallApp
} from './logic';

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
