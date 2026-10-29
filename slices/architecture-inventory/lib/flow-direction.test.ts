import { expect, it } from 'vitest';
import { flowCard, layoutGraph, routeEdges } from './graph';
import {
	createDocument,
	documentAsJson,
	documentAsMarkdown,
	parseDiagramDocument,
	parseDiagramMarkdown
} from './document';
import { buildDiagramViewUrl, parseDiagramView } from './share';
import { runGraphTool } from './tools';
import type { ArchitectureGraph, FlowDirection } from '../types';

const graph: ArchitectureGraph = {
	schemaVersion: 1,
	nodes: [
		{
			id: 'a',
			label: 'Alpha',
			level: 0,
			tags: [],
			inputs: [],
			outputs: [{ id: 'out', label: 'Provides' }]
		},
		{
			id: 'b',
			label: 'Beta',
			level: 1,
			tags: [],
			inputs: [{ id: 'in', label: 'Consumes' }],
			outputs: []
		}
	],
	edges: [{ id: 'ab', source: 'a', sourcePort: 'out', target: 'b', targetPort: 'in' }]
};

it.each(['LR', 'RL', 'TB', 'BT'] as FlowDirection[])(
	'lays out and routes upright cards with correct port sides for %s',
	(direction) => {
		const positions = layoutGraph(graph, 'flow', direction);
		const { a, b } = positions;
		if (direction === 'LR') expect(a.x).toBeLessThan(b.x);
		if (direction === 'RL') expect(a.x).toBeGreaterThan(b.x);
		if (direction === 'TB') expect(a.y).toBeLessThan(b.y);
		if (direction === 'BT') expect(a.y).toBeGreaterThan(b.y);
		const route = routeEdges(graph, positions, 'flow', direction)[0];
		const start = route.points[0],
			end = route.points.at(-1)!;
		if (direction === 'LR') {
			expect(start).toEqual({ x: a.x + flowCard.width, y: a.y + flowCard.height / 2 });
			expect(end.x).toBe(b.x);
		}
		if (direction === 'RL') {
			expect(start.x).toBe(a.x);
			expect(end.x).toBe(b.x + flowCard.width);
		}
		if (direction === 'TB') {
			expect(start).toEqual({ x: a.x + flowCard.width / 2, y: a.y + flowCard.height });
			expect(end.y).toBe(b.y);
		}
		if (direction === 'BT') {
			expect(start.y).toBe(a.y);
			expect(end.y).toBe(b.y + flowCard.height);
		}
		expect(route.d).toContain(' C ');
		expect(
			route.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
		).toBe(true);
		const document = createDocument(graph);
		document.ui = { diagramMode: 'flow', flowDirection: direction };
		expect(parseDiagramDocument(documentAsJson(document))).toEqual(document);
		expect(parseDiagramMarkdown(documentAsMarkdown(document))).toEqual(document);
		const url = buildDiagramViewUrl({ graph, mode: 'flow', flowDirection: direction });
		expect(parseDiagramView(new URL(url).search).flowDirection).toBe(direction);
		const mcp = runGraphTool(graph, [], 'graph_build_view', { mode: 'flow', direction }) as {
			url: string;
		};
		expect(parseDiagramView(new URL(mcp.url).search).flowDirection).toBe(direction);
	}
);

it('keeps legacy LR geometry and graph layout independent of the Flow direction', () => {
	expect(layoutGraph(graph, 'flow')).toEqual(layoutGraph(graph, 'flow', 'LR'));
	expect(layoutGraph(graph, 'graph', 'TB')).toEqual(layoutGraph(graph, 'graph', 'RL'));
	expect(new URL(buildDiagramViewUrl({ mode: 'flow' })).searchParams.has('direction')).toBe(false);
	const document = createDocument(graph);
	document.ui = { flowDirection: 'invalid' as FlowDirection };
	expect(() => parseDiagramDocument(JSON.stringify(document))).toThrow(/contract/);
});
