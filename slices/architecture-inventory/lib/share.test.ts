import { describe, expect, test } from 'vitest';
import {
	buildDiagramViewUrl,
	parseDiagramView,
	tagsMatchFacets,
	PORTABLE_GRAPH_MAX_CHARS
} from './share';
import { defaultGraph } from '../config/default-graph';
import { cloneGraph } from './graph';

describe('portable context graph views', () => {
	test('round-trips a bounded graph and view filters', () => {
		const url = buildDiagramViewUrl({
			graph: defaultGraph,
			query: 'mso',
			tags: ['project:mso', 'kind:product'],
			seeds: ['mso'],
			mode: 'graph',
			trace: 'direct',
			focus: true
		});
		const parsed = parseDiagramView(new URL(url).search);
		expect(parsed.graph?.nodes.length).toBe(defaultGraph.nodes.length);
		expect(parsed.tags).toEqual(['project:mso', 'kind:product']);
		expect(parsed.seeds).toEqual(['mso']);
		expect(parsed.mode).toBe('graph');
		expect(parsed.trace).toBe('direct');
		expect(parsed.focus).toBe(true);
		expect(parsed.open).toEqual([]);
		const nested = buildDiagramViewUrl({ open: ['architecture', 'contract'], mode: 'flow' });
		expect(new URL(nested).searchParams.getAll('open')).toEqual(['architecture', 'contract']);
		expect(parseDiagramView(new URL(nested).search).open).toEqual(['architecture', 'contract']);
		expect(new URL(nested).searchParams.has('graph')).toBe(false);
	});

	test('ORs tags inside one facet and ANDs across facets', () => {
		const tags = ['project:mso', 'platform:vercel', 'agent:lara'];
		expect(tagsMatchFacets(tags, ['project:mso', 'agent:lara'])).toBe(true);
		expect(tagsMatchFacets(tags, ['agent:lara', 'agent:manef'])).toBe(true);
		expect(tagsMatchFacets(tags, ['project:mso', 'platform:convex'])).toBe(false);
	});

	test('rejects malformed and oversized incoming graph payloads', () => {
		expect(() => parseDiagramView('?graph=not-json')).toThrow();
		expect(() => parseDiagramView('?graph=%7B%7D')).toThrow();
		const graph = { schemaVersion: 1, nodes: [], edges: [] };
		const payload = JSON.stringify(graph).padEnd(PORTABLE_GRAPH_MAX_CHARS + 1, ' ');
		expect(() => parseDiagramView(`?graph=${encodeURIComponent(payload)}`)).toThrow(/size limit/);
	});
	test('preserves unknown graph and nested extension fields in portable links', () => {
		const graph = cloneGraph(defaultGraph);
		Object.assign(graph, { extensions: { vendor: { version: 1 } } });
		Object.assign(graph.nodes[0], { custom: { source: ['local', true] } });
		const url = buildDiagramViewUrl({ graph });
		expect(parseDiagramView(new URL(url).search).graph).toEqual(graph);
	});

	test('rejects non-JSON extension values before a portable link can truncate them', () => {
		const cyclic: Record<string, unknown> = {};
		cyclic.self = cyclic;
		const invalid: unknown[] = [
			undefined,
			Number.NaN,
			Number.POSITIVE_INFINITY,
			() => 1,
			new Date(),
			cyclic
		];
		for (const value of invalid) {
			const graph = cloneGraph(defaultGraph);
			Object.assign(graph.nodes[0], { custom: value });
			expect(() => buildDiagramViewUrl({ graph })).toThrow(/JSON/);
		}
		const graph = cloneGraph(defaultGraph);
		let getterCalls = 0;
		Object.defineProperty(graph, 'custom', {
			get: () => {
				getterCalls += 1;
				return 'lost';
			},
			enumerable: true
		});
		expect(() => buildDiagramViewUrl({ graph })).toThrow(/JSON/);
		expect(getterCalls).toBe(0);
	});
});
