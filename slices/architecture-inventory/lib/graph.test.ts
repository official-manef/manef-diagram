import { describe, expect, it } from 'vitest';
import { defaultGraph } from '../config/default-graph';
import {
	addEdge,
	cloneGraph,
	flowCard,
	layoutGraph,
	routeEdges,
	traceGraph,
	validateGraph
} from './graph';
import { addInventoryItem } from './inventory';

describe('architecture graph core', () => {
	it('validates the bundled graph', () => {
		expect(validateGraph(defaultGraph)).toBe(true);
	});

	it('traces direct neighbors and the whole connected component', () => {
		const direct = traceGraph(defaultGraph, ['manef-dev'], 'direct');
		expect(direct.nodeIds).toContain('manef');
		expect(direct.nodeIds).toContain('architecture');

		const component = traceGraph(defaultGraph, ['architecture'], 'component');
		expect(component.nodeIds).toContain('manef');
		expect(component.nodeIds).toContain('ops');
	});

	it('does not add duplicate endpoint connections', () => {
		const graph = cloneGraph(defaultGraph);
		const duplicate = { ...graph.edges[0], id: 'another-id' };
		expect(addEdge(graph, duplicate).edges).toHaveLength(graph.edges.length);
	});

	it('spaces and centers the flow columns so cards do not stack', () => {
		const points = layoutGraph(defaultGraph, 'flow');
		const nodes = defaultGraph.nodes;
		for (let i = 0; i < nodes.length; i += 1) {
			for (let j = i + 1; j < nodes.length; j += 1) {
				const a = points[nodes[i].id];
				const b = points[nodes[j].id];
				const overlaps =
					a.x < b.x + flowCard.width &&
					a.x + flowCard.width > b.x &&
					a.y < b.y + flowCard.height &&
					a.y + flowCard.height > b.y;
				expect(overlaps).toBe(false);
			}
		}
		const levelTwo = defaultGraph.nodes
			.filter((node) => node.level === 2)
			.map((node) => points[node.id].y)
			.sort((a, b) => a - b);
		for (let index = 1; index < levelTwo.length; index += 1) {
			expect(levelTwo[index] - levelTwo[index - 1]).toBeGreaterThanOrEqual(
				flowCard.height + flowCard.gapY
			);
		}
		expect(points['manef-dev'].y).toBe(levelTwo[Math.floor(levelTwo.length / 2)]);
		for (const node of defaultGraph.nodes.filter((item) => item.level === 2)) {
			expect(points[node.id].x).toBeGreaterThan(points['manef-dev'].x);
		}
	});

	it('labels every public connection and keeps those lines out of other cards', () => {
		for (const mode of ['flow', 'graph'] as const) {
			const points = layoutGraph(defaultGraph, mode);
			const routes = routeEdges(defaultGraph, points, mode);
			expect(routes.map((route) => route.label).filter(Boolean)).toHaveLength(
				defaultGraph.edges.length
			);
			for (const route of routes) {
				const edge = defaultGraph.edges.find((item) => item.id === route.id)!;
				for (let segment = 1; segment < route.points.length; segment += 1) {
					const start = route.points[segment - 1];
					const end = route.points[segment];
					for (let step = 0; step <= 12; step += 1) {
						const t = step / 12;
						const point = {
							x: start.x + (end.x - start.x) * t,
							y: start.y + (end.y - start.y) * t
						};
						for (const node of defaultGraph.nodes) {
							if (node.id === edge.source || node.id === edge.target) continue;
							const box = points[node.id];
							const inside =
								point.x > box.x + 6 &&
								point.x < box.x + flowCard.width - 6 &&
								point.y > box.y + 6 &&
								point.y < box.y + flowCard.height - 6;
							expect(inside).toBe(false);
						}
					}
				}
			}
		}
	});

	it('materializes inventory once', () => {
		const item = { id: 'sample', label: 'Sample', tags: ['sample'] };
		const once = addInventoryItem(defaultGraph, item);
		const twice = addInventoryItem(once, item);
		expect(once.nodes.some((node) => node.id === 'sample')).toBe(true);
		expect(twice.nodes).toHaveLength(once.nodes.length);
	});
});
