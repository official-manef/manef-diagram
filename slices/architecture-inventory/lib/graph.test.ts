import { describe, expect, it } from 'vitest';
import { defaultGraph } from '../config/default-graph';
import {
	addEdge,
	cloneGraph,
	diagramAt,
	flowCard,
	graphDot,
	layoutGraph,
	parseImportedGraph,
	routeEdges,
	relatedView,
	sameGraph,
	settleTick,
	traceGraph,
	validateGraph,
	writeDiagram,
	MAX_DIAGRAM_DEPTH
} from './graph';
import { addInventoryItem } from './inventory';

describe('architecture graph core', () => {
	it('validates the bundled graph', () => {
		expect(validateGraph(defaultGraph)).toBe(true);
		expect(defaultGraph.nodes).toHaveLength(9);
		expect(defaultGraph.edges).toHaveLength(8);
		expect(JSON.stringify(defaultGraph).length).toBeLessThanOrEqual(6_000);
		const text = JSON.stringify(defaultGraph);
		expect(text).not.toContain('Open Silong');
		expect(text).not.toContain('Convex Cloud');
		expect(text).not.toContain('Dokploy');
	});

	it('opens the diagram product into its own component diagram', () => {
		const product = diagramAt(defaultGraph, ['architecture']);
		expect(product?.nodes.map((node) => node.id)).toEqual([
			'directory',
			'canvas',
			'workspace',
			'contract',
			'mcp'
		]);
		expect(product?.edges.map((edge) => edge.label)).toEqual([
			'opens',
			'opens demo',
			'renders',
			'simulates',
			'reads'
		]);
		expect(diagramAt(defaultGraph, ['mso'])).toBeNull();
		expect(diagramAt(defaultGraph, ['architecture', 'contract'])).toBeNull();

		const points = layoutGraph(product!, 'flow');
		for (let i = 0; i < product!.nodes.length; i += 1) {
			for (let j = i + 1; j < product!.nodes.length; j += 1) {
				const a = points[product!.nodes[i].id];
				const b = points[product!.nodes[j].id];
				const overlaps =
					a.x < b.x + flowCard.width &&
					a.x + flowCard.width > b.x &&
					a.y < b.y + flowCard.height &&
					a.y + flowCard.height > b.y;
				expect(overlaps).toBe(false);
			}
		}
	});

	it('keeps a child edit on the parent and rejects a diagram that is too deep', () => {
		const opened = diagramAt(defaultGraph, ['architecture']);
		expect(opened).toBeTruthy();
		const renamed = {
			...opened!,
			nodes: opened!.nodes.map((node) =>
				node.id === 'canvas' ? { ...node, label: 'Renamed map' } : node
			)
		};
		const written = writeDiagram(defaultGraph, ['architecture'], renamed);
		expect(
			diagramAt(written, ['architecture'])?.nodes.find((node) => node.id === 'canvas')?.label
		).toBe('Renamed map');
		expect(sameGraph(written, defaultGraph)).toBe(false);
		expect(writeDiagram(defaultGraph, ['missing'], renamed)).toBe(defaultGraph);

		const clone = cloneGraph(defaultGraph);
		const child = diagramAt(clone, ['architecture']);
		child!.nodes[0].label = 'Mutated';
		expect(diagramAt(defaultGraph, ['architecture'])?.nodes[0].label).not.toBe('Mutated');

		let deep = cloneGraph(defaultGraph);
		for (let level = 0; level <= MAX_DIAGRAM_DEPTH; level += 1) {
			deep = {
				schemaVersion: 1,
				nodes: [
					{
						id: `d${level}`,
						label: 'Deep',
						tags: [],
						inputs: [{ id: 'in', label: 'In' }],
						outputs: [{ id: 'out', label: 'Out' }],
						child: deep
					}
				],
				edges: []
			};
		}
		expect(validateGraph(deep)).toBe(false);
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

	it('gives every public connection its own label', () => {
		const labels = defaultGraph.edges.map((edge) => edge.label);
		expect(new Set(labels).size).toBe(labels.length);
		expect(labels).not.toContain('product');
	});

	it('keeps the other end of a connection when a filter matches one service', () => {
		const view = relatedView(defaultGraph, ['ops']);
		expect(view.edges.map((edge) => edge.id)).toEqual(['domain-ops']);
		expect(view.contextIds).toEqual(['manef-dev']);
		expect(view.nodeIds).toEqual(expect.arrayContaining(['ops', 'manef-dev']));

		const none = relatedView(defaultGraph, []);
		expect(none.edges).toEqual([]);
		expect(none.contextIds).toEqual([]);
		expect(none.nodeIds).toEqual([]);
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
			.map((node) => points[node.id]);
		const lanes = new Map<number, number[]>();
		for (const point of levelTwo) {
			const column = lanes.get(point.x) ?? [];
			column.push(point.y);
			lanes.set(point.x, column);
		}
		expect(lanes.size).toBeGreaterThan(1);
		for (const column of lanes.values()) {
			const ys = [...column].sort((a, b) => a - b);
			for (let index = 1; index < ys.length; index += 1) {
				expect(ys[index] - ys[index - 1]).toBeGreaterThanOrEqual(flowCard.height + flowCard.gapY);
			}
		}
		const top = Math.min(...levelTwo.map((point) => point.y));
		const bottom = Math.max(...levelTwo.map((point) => point.y)) + flowCard.height;
		expect(points['manef-dev'].y + flowCard.height / 2).toBeCloseTo((top + bottom) / 2, 0);
		for (const node of defaultGraph.nodes.filter((item) => item.level === 2)) {
			expect(points[node.id].x).toBeGreaterThan(points['manef-dev'].x);
		}
		const xs = nodes.map((node) => points[node.id].x);
		const ys = nodes.map((node) => points[node.id].y);
		const width = Math.max(...xs) + flowCard.width - Math.min(...xs);
		const height = Math.max(...ys) + flowCard.height - Math.min(...ys);
		expect(Math.min(1360 / width, 760 / height)).toBeGreaterThanOrEqual(0.9);
	});

	it('labels every public connection and keeps those lines out of other cards', () => {
		for (const mode of ['flow', 'graph'] as const) {
			const points = layoutGraph(defaultGraph, mode);
			const routes = routeEdges(defaultGraph, points, mode);
			expect(routes.map((route) => route.label).filter(Boolean)).toHaveLength(
				defaultGraph.edges.length
			);
			for (const route of routes) {
				expect(route.d.includes(' C ')).toBe(mode === 'flow');
			}
			for (const route of routes) {
				const textWidth = route.label.length * 7.2;
				const box = {
					left: route.x - textWidth / 2,
					right: route.x + textWidth / 2,
					top: route.y - 14,
					bottom: route.y + 2
				};
				for (const node of defaultGraph.nodes) {
					const card = points[node.id];
					const hits =
						mode === 'graph'
							? box.right > card.x - graphDot.radius - 6 &&
								box.left < card.x + graphDot.radius + 6 &&
								box.bottom > card.y - graphDot.radius - 6 &&
								box.top < card.y + graphDot.radius + 6
							: box.right > card.x + 2 &&
								box.left < card.x + flowCard.width - 2 &&
								box.bottom > card.y + 2 &&
								box.top < card.y + flowCard.height - 2;
					expect(hits, `${mode} ${route.label} overlaps ${node.id}`).toBe(false);
				}
			}
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
								mode === 'graph'
									? (point.x - box.x) ** 2 + (point.y - box.y) ** 2 < (graphDot.radius + 2) ** 2
									: point.x > box.x + 6 &&
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
		const item = { id: 'sample', label: 'Sample', tags: ['sample'], kind: 'reference' as const };
		const once = addInventoryItem(defaultGraph, item);
		const twice = addInventoryItem(once, item);
		expect(once.nodes.some((node) => node.id === 'sample')).toBe(true);
		expect(once.nodes.find((node) => node.id === 'sample')?.inventoryRef).toEqual({
			kind: 'reference',
			key: 'sample'
		});
		expect(twice.nodes).toHaveLength(once.nodes.length);
	});

	it('imports a bare graph or a document that wraps one', () => {
		const bare = JSON.stringify(defaultGraph);
		expect(parseImportedGraph(bare).nodes).toHaveLength(defaultGraph.nodes.length);
		const wrapped = JSON.stringify({
			schemaVersion: 1,
			title: 'MANEF Architecture',
			graph: defaultGraph,
			ui: { diagramMode: 'flow' }
		});
		expect(sameGraph(parseImportedGraph(wrapped), defaultGraph)).toBe(true);
		expect(() => parseImportedGraph('{"graph":{"nodes":[]}}')).toThrow(/contract/);
	});

	it('settles graph positions without dropping a node', () => {
		let positions = layoutGraph(defaultGraph, 'graph');
		let velocity = {};
		const before = JSON.stringify(positions);
		for (let step = 0; step < 12; step += 1) {
			const next = settleTick(defaultGraph, positions, velocity);
			positions = next.positions;
			velocity = next.velocity;
		}
		expect(Object.keys(positions).sort()).toEqual(defaultGraph.nodes.map((node) => node.id).sort());
		for (const point of Object.values(positions)) {
			expect(Number.isFinite(point.x)).toBe(true);
			expect(Number.isFinite(point.y)).toBe(true);
		}
		expect(JSON.stringify(positions)).not.toBe(before);
	});
});
