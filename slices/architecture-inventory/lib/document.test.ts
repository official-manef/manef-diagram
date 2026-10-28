import { describe, expect, it } from 'vitest';
import { defaultGraph } from '../config/default-graph';
import type { ArchitectureGraph } from '../types';
import { createNodeView, DIAGRAM_KINDS } from './diagram-views';
import {
	cloneDocument,
	cloneJson,
	createDocument,
	documentAsJson,
	documentAsMarkdown,
	isJsonValue,
	MAX_DOCUMENT_INPUT_CHARS,
	parseDiagramDocument,
	parseDiagramMarkdown,
	sameJson,
	validateDiagramDocument,
	type DiagramDocument
} from './document';
import { cloneGraph, sameGraph, writeDiagram } from './graph';
import { materializeInventoryItem } from './inventory';

const ticks = String.fromCharCode(96);

function documentFixture(): DiagramDocument {
	const document = createDocument(defaultGraph, 'All diagram kinds');
	document.ui = {
		themePreset: 'composio-dark',
		diagramMode: 'graph',
		traceMode: 'component',
		focusMode: true,
		query: 'canvas',
		tags: ['kind:service'],
		seeds: ['architecture'],
		open: ['architecture'],
		pan: { x: -12, y: 40 },
		zoom: 0.8,
		positions: { architecture: { x: 11, y: 22 } },
		layouts: { '[]': { architecture: { x: 11, y: 22 } } },
		futureUi: { snap: true }
	};
	document.inventory = [
		Object.assign({ id: 'custom', label: 'Custom', tags: [] }, { custom: { preserved: 1 } })
	];
	document.metadata = { language: 'id', nested: [{ one: true }, null, 1] };
	document.extensions = {
		n8n: { workflow: { nodes: [], connections: {}, settings: { executionOrder: 'v1' } } }
	};
	const graph = document.graph as ArchitectureGraph & { custom: unknown };
	graph.custom = { graph: ['kept'] };
	const parent = graph.nodes.find((node) => node.child)!;
	Object.assign(parent, {
		custom: { node: ['kept'] },
		views: DIAGRAM_KINDS.map((kind) => ({
			...createNodeView(kind.id, parent.label),
			id: 'view-' + kind.id,
			custom: { view: ['kept'] }
		}))
	});
	Object.assign(parent.inputs[0], { custom: { port: ['kept'] } });
	Object.assign(parent.child!, { custom: { child: ['kept'] } });
	Object.assign(graph.edges[0], { custom: { edge: ['kept'] } });
	return document;
}

describe('canonical diagram documents', () => {
	it('round-trips the complete document and all Mermaid kinds through JSON and Markdown', () => {
		const original = documentFixture();
		expect(validateDiagramDocument(original)).toBe(true);
		const json = documentAsJson(original);
		expect(parseDiagramDocument(json)).toEqual(original);
		const markdown = documentAsMarkdown(original);
		const restored = parseDiagramMarkdown(markdown);
		expect(restored).toEqual(original);
		expect(sameJson(restored, original)).toBe(true);
		expect(restored.graph.nodes.find((node) => node.views)?.views).toHaveLength(
			DIAGRAM_KINDS.length
		);
		expect(markdown).toContain('flowchart LR');
		expect(markdown).toContain('manef-diagram-json');
		expect(documentAsJson(restored)).toBe(json);
	});

	it('migrates bare graphs and legacy envelopes while retaining unknown fields', () => {
		const bare = JSON.stringify(defaultGraph);
		expect(parseDiagramDocument(bare).graph).toEqual(defaultGraph);
		const graphWithMetadata = Object.assign(cloneGraph(defaultGraph), {
			custom: { graph: 'graph-level metadata' }
		});
		expect(parseDiagramDocument(JSON.stringify(graphWithMetadata)).graph).toEqual(
			graphWithMetadata
		);
		const legacy = {
			schemaVersion: 1,
			title: 'Legacy',
			graph: defaultGraph,
			ui: { diagramMode: 'flow', oldSetting: ['keep'] },
			audit: { source: 'older editor' }
		};
		expect(parseDiagramDocument(JSON.stringify(legacy))).toEqual({
			...legacy,
			format: 'manef-diagram'
		});
	});

	it.each([
		{ format: 'unsupported', schemaVersion: 1, nodes: [], edges: [] },
		{ format: 'manef-diagram', schemaVersion: 1, nodes: [], edges: [] },
		{ schemaVersion: 1, nodes: [], edges: [], graph: { schemaVersion: 1, nodes: [], edges: [] } }
	])('rejects explicitly tagged or ambiguous bare graphs: %j', (value) => {
		expect(() => parseDiagramDocument(JSON.stringify(value))).toThrow(/format|Ambiguous/);
	});

	it('keeps accepted compact documents exportable when indentation exceeds the text limit', () => {
		const original = createDocument({ schemaVersion: 1, nodes: [], edges: [] });
		original.extensions = {
			text: 'x'.repeat(4_200_000),
			values: Array.from({ length: 100_000 }, () => 1)
		};
		expect(JSON.stringify(original, null, 2).length).toBeGreaterThan(MAX_DOCUMENT_INPUT_CHARS);
		const imported = parseDiagramDocument(JSON.stringify(original));
		const json = documentAsJson(imported);
		const markdown = documentAsMarkdown(imported);
		expect(json.length).toBeLessThanOrEqual(MAX_DOCUMENT_INPUT_CHARS);
		expect(markdown.length).toBeLessThanOrEqual(MAX_DOCUMENT_INPUT_CHARS);
		expect(parseDiagramDocument(json)).toEqual(original);
		expect(parseDiagramMarkdown(markdown)).toEqual(original);
	});

	it('reserves a collision-safe Markdown envelope at the canonical transport boundary', () => {
		const original = createDocument({ schemaVersion: 1, nodes: [], edges: [] });
		original.extension = '';
		const overhead = JSON.stringify(original).length;
		original.extension = 'x'.repeat(MAX_DOCUMENT_INPUT_CHARS - overhead - 64);
		const accepted = parseDiagramDocument(JSON.stringify(original));
		expect(parseDiagramMarkdown(documentAsMarkdown(accepted))).toEqual(original);
		original.extension = 'x'.repeat(MAX_DOCUMENT_INPUT_CHARS - overhead);
		expect(JSON.stringify(original).length).toBe(MAX_DOCUMENT_INPUT_CHARS);
		expect(() => parseDiagramDocument(JSON.stringify(original))).toThrow(/5,000,000/);
	});

	it('preserves graph root metadata, nested extensions and independent clones after edits', () => {
		const document = documentFixture();
		const copy = cloneDocument(document);
		const graph = cloneGraph(document.graph);
		expect(graph).toEqual(document.graph);
		expect(sameGraph(graph, document.graph)).toBe(true);
		(graph as ArchitectureGraph & { custom: { graph: string[] } }).custom.graph.push('changed');
		expect(sameGraph(graph, document.graph)).toBe(false);
		expect(document.graph).toEqual(copy.graph);
		const parent = graph.nodes.find((node) => node.child)!;
		const next = writeDiagram(graph, [parent.id], cloneGraph(parent.child!));
		expect((next as ArchitectureGraph & { custom: unknown }).custom).toEqual({
			graph: ['kept', 'changed']
		});
		Object.assign(next.nodes[0], { custom: { changed: true } });
		expect(sameGraph(next, graph)).toBe(false);
	});

	it('compares object key order independently while retaining meaningful array and extension differences', () => {
		expect(sameJson({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 })).toBe(true);
		expect(sameJson({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
		const original = documentFixture();
		const reordered = JSON.parse(documentAsJson(original)) as DiagramDocument;
		Object.assign(reordered.graph.nodes[0], { unknown: true });
		expect(sameGraph(original.graph, reordered.graph)).toBe(false);
	});

	it('uses collision-safe Markdown fences and ignores counterfeit blocks nested inside projections', () => {
		const document = createDocument(defaultGraph, 'Fences');
		document.graph.nodes[0].views = [
			{
				id: 'collision',
				title: 'Collision',
				kind: 'flowchart',
				format: 'md',
				source:
					'# Notes\n\n' +
					ticks.repeat(4) +
					'mermaid\nflowchart LR\n  A --> B\n' +
					ticks.repeat(3) +
					'manef-diagram-json\n{}\n' +
					ticks.repeat(3) +
					'\n' +
					ticks.repeat(4) +
					'\n'
			}
		];
		const markdown = documentAsMarkdown(document);
		expect(markdown).toContain(ticks.repeat(5) + 'manef-diagram-json');
		expect(parseDiagramMarkdown(markdown)).toEqual(document);
	});

	it('requires a single authoritative payload and supports tilde fences and CRLF', () => {
		const document = createDocument(defaultGraph);
		const block =
			'~~~manef-diagram-json\r\n' + documentAsJson(document).replaceAll('\n', '\r\n') + '\r\n~~~';
		expect(parseDiagramMarkdown(block)).toEqual(document);
		const invalidInfoLine = ticks.repeat(3) + 'other' + ticks + 'info\n';
		expect(parseDiagramMarkdown(invalidInfoLine + block)).toEqual(document);
		expect(() =>
			parseDiagramMarkdown(ticks.repeat(3) + 'mermaid\nflowchart LR\nA-->B\n' + ticks.repeat(3))
		).toThrow(/exactly one/);
		expect(() => parseDiagramMarkdown(block + '\n' + block)).toThrow(/exactly one/);
		expect(() => parseDiagramMarkdown(ticks.repeat(3) + 'manef-diagram-json\n{}')).toThrow(
			/not closed/
		);
	});

	it.each([
		{ schemaVersion: 2 },
		{ format: 'different' },
		{ title: 42 },
		{ ui: { diagramMode: 'unknown' } },
		{ ui: { themePreset: 'unknown' } },
		{ ui: { themePreset: ['system'] } },
		{ ui: { traceMode: 'unknown' } },
		{ ui: { focusMode: 'false' } },
		{ ui: { query: [] } },
		{ ui: { tags: [false] } },
		{ ui: { seeds: [0] } },
		{ ui: { open: 'node' } },
		{ ui: { zoom: 0 } },
		{ ui: { pan: { x: 0, y: '0' } } },
		{ ui: { positions: { node: { x: '0', y: 0 } } } },
		{ ui: { layouts: { '[]': [] } } },
		{ inventory: [{ id: 'bad', label: 'Bad', tags: [], kind: 'anything' }] },
		{ inventory: [{ id: 'bad', label: 'Bad', tags: [], kind: ['reference'] }] },
		{ inventory: [{ id: 'bad', label: 'Bad', tags: [], inputs: null }] },
		{ inventory: [{ id: 'bad', label: 'Bad', tags: [], outputs: null }] },
		{ inventory: [{ id: 'bad', label: 'Bad', tags: [], status: 'anything' }] }
	])('rejects unsupported versions and malformed known fields: %j', (patch) => {
		const value = { ...createDocument(defaultGraph), ...patch };
		expect(validateDiagramDocument(value)).toBe(false);
		expect(() => parseDiagramDocument(JSON.stringify(value))).toThrow();
	});

	it('limits serialized inputs before parsing without changing the previous document', () => {
		const document = documentFixture();
		const before = cloneDocument(document);
		expect(() => parseDiagramDocument(' '.repeat(MAX_DOCUMENT_INPUT_CHARS + 1))).toThrow(
			/5,000,000/
		);
		expect(() => parseDiagramMarkdown(' '.repeat(MAX_DOCUMENT_INPUT_CHARS + 1))).toThrow(
			/5,000,000/
		);
		expect(document).toEqual(before);
	});

	it('rejects non-JSON extension data instead of silently truncating it', () => {
		const values: unknown[] = [
			undefined,
			Number.NaN,
			Number.POSITIVE_INFINITY,
			1n,
			new Date(),
			() => 1
		];
		const cyclic: Record<string, unknown> = {};
		cyclic.self = cyclic;
		values.push(cyclic);
		values.push(Object.defineProperty({}, 'secret', { value: 'hidden' }));
		values.push(Object.defineProperty({}, 'getter', { get: () => 'computed', enumerable: true }));
		values.push({ [Symbol('hidden')]: 'symbol' });
		values.push(new Array(2));
		const disguisedSparse: unknown[] = new Array(1);
		Object.assign(disguisedSparse, { extra: 'lost' });
		values.push(disguisedSparse);
		const augmented: unknown[] = [];
		Object.assign(augmented, { extra: 'lost' });
		values.push(augmented);
		for (const value of values) {
			const document = { ...createDocument(defaultGraph), extension: value };
			expect(isJsonValue(document)).toBe(false);
			expect(validateDiagramDocument(document)).toBe(false);
			expect(() => documentAsJson(document)).toThrow(/JSON/);
			expect(() => cloneJson(value)).toThrow(/JSON/);
		}
	});

	it('keeps JSON keys that resemble object prototype properties as inert data', () => {
		const document = parseDiagramDocument(
			JSON.stringify({
				...createDocument(defaultGraph),
				extensions: JSON.parse(
					'{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}'
				) as unknown
			})
		);
		expect(documentAsJson(document)).toContain('__proto__');
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
		expect(parseDiagramMarkdown(documentAsMarkdown(document))).toEqual(document);
	});

	it('materializes minimal inventory entries without non-JSON optional values', () => {
		const node = materializeInventoryItem({ id: 'minimal', label: 'Minimal', tags: [] });
		expect(isJsonValue(node)).toBe(true);
		const graph: ArchitectureGraph = { schemaVersion: 1, nodes: [node], edges: [] };
		expect(() => createDocument(cloneGraph(graph))).not.toThrow();
		const full = materializeInventoryItem({
			id: 'full',
			label: 'Full',
			tags: [],
			subtitle: '',
			group: 'custom',
			status: 'proposed'
		});
		expect(full).toMatchObject({ subtitle: '', group: 'custom', status: 'proposed' });
	});
	it('rejects integers that JavaScript cannot represent exactly and negative zero before serialization', () => {
		for (const counter of [Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER - 1, -0]) {
			const document = { ...createDocument(defaultGraph), metadata: { counter } };
			expect(isJsonValue(document)).toBe(false);
			expect(() => documentAsJson(document)).toThrow(/safe integers.*strings/);
		}
		const oversizedIntegerJson = documentAsJson(createDocument(defaultGraph)).replace(
			'{',
			'{"counter":9007199254740993,'
		);
		expect(() => parseDiagramDocument(oversizedIntegerJson)).toThrow(/safe integers.*strings/);
		const negativeZeroJson = documentAsJson(createDocument(defaultGraph)).replace(
			'{',
			'{"counter":-0,'
		);
		expect(() => parseDiagramDocument(negativeZeroJson)).toThrow(/negative zero/);
		const document = {
			...createDocument(defaultGraph),
			metadata: {
				integer: Number.MAX_SAFE_INTEGER,
				negative: Number.MIN_SAFE_INTEGER,
				fractional: 0.125,
				identifier: '9007199254740993'
			}
		};
		expect(parseDiagramMarkdown(documentAsMarkdown(document))).toEqual(document);
	});
});
