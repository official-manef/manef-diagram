import { describe, expect, it } from 'vitest';
import type { NodeView } from '../types';
import {
	DIAGRAM_KINDS,
	MAX_NODE_VIEW_SOURCE_LENGTH,
	convertNodeView,
	createNodeView,
	isNodeView,
	mermaidSource,
	viewAsJson,
	viewAsMarkdown
} from './diagram-views';

function jsonView(extra: Record<string, unknown> = {}): NodeView {
	return {
		id: 'view-original',
		kind: 'flowchart',
		title: 'Peta 日本語 🧭',
		format: 'json',
		source:
			'{\n  "source": "flowchart LR\\n  A[Mulai] --> B[Selesai]",\n  "settings": {"theme": "dark", "unknown": [null, false, 1]}\n}\n',
		...extra
	};
}

function jsonEnvelope(
	view: NodeView,
	schemaVersion = 1,
	extra: Record<string, unknown> = {}
): string {
	return JSON.stringify({ format: 'manef-node-view', schemaVersion, view, ...extra });
}

describe('diagram formats', () => {
	it('keeps legacy display helpers available for all bundled diagrams', () => {
		expect(DIAGRAM_KINDS).toHaveLength(24);
		for (const kind of DIAGRAM_KINDS) {
			const view = createNodeView(kind.id, 'Map');
			expect(view.format).toBe('md');
			const body = mermaidSource(view);
			expect(body.startsWith(kind.keyword)).toBe(true);
			const json = viewAsJson({ ...view, source: body, format: 'md' });
			expect(mermaidSource({ kind: kind.id, format: 'json', source: json })).toBe(body);
			expect(
				mermaidSource({
					...view,
					format: 'md',
					source: viewAsMarkdown({ title: view.title, source: body })
				})
			).toBe(body);
		}
	});

	it.each(DIAGRAM_KINDS)('restores exact Markdown and JSON views for $id', (kind) => {
		const markdown = {
			...createNodeView(kind.id, 'Peta 🧭'),
			metadata: { owner: 'local-fixture', nested: { flags: [true, null, '日本語'] } }
		};
		const converted = convertNodeView(markdown, 'json');
		expect(converted.format).toBe('json');
		expect(isNodeView(converted)).toBe(true);
		expect(mermaidSource(converted)).toBe(mermaidSource(markdown));
		expect(convertNodeView(converted, 'md')).toEqual(markdown);
		expect(convertNodeView(converted, 'json')).toEqual(converted);

		const json = {
			...markdown,
			format: 'json' as const,
			source: JSON.stringify(
				{ source: mermaidSource(markdown), unknown: { diagram: kind.id } },
				null,
				4
			)
		};
		const convertedMarkdown = convertNodeView(json, 'md');
		expect(isNodeView(convertedMarkdown)).toBe(true);
		expect(mermaidSource(convertedMarkdown)).toBe(mermaidSource(json));
		expect(convertNodeView(convertedMarkdown, 'json')).toEqual(json);
		expect(convertNodeView(convertedMarkdown, 'md')).toEqual(convertedMarkdown);
	});
});

describe('lossless node view conversion', () => {
	it('retains prose, line endings, multiple code fences and Unicode exactly', () => {
		const view: NodeView = {
			...createNodeView('flowchart', 'Map'),
			source:
				'# Judul 日本語\r\n\r\nProsa sebelum.\r\n\r\n~~~json\r\n{"example": true}\r\n~~~\r\n\r\n````mermaid\r\nflowchart LR\r\n  A --> B\r\n````\r\n\r\nProsa setelah 🧭.\r\n'
		};
		const converted = convertNodeView(view, 'json');
		expect(convertNodeView(converted, 'md')).toEqual(view);
		expect(mermaidSource(converted)).toBe('flowchart LR\r\n  A --> B');
	});

	it('retains multiple Mermaid diagrams without choosing and discarding one', () => {
		const view: NodeView = {
			...createNodeView('flowchart', 'Map'),
			source:
				'Before\n\n```mermaid\nflowchart LR\nA --> B\n```\nBetween\n```mermaid\nflowchart LR\nC --> D\n```\nAfter\n'
		};
		const converted = convertNodeView(view, 'json');
		expect(isNodeView(converted)).toBe(true);
		expect(convertNodeView(converted, 'md')).toEqual(view);
		expect(() => mermaidSource(converted)).toThrow('multiple Mermaid diagrams');
	});

	it('preserves JSON formatting, unknown fields and view metadata without mutating input', () => {
		const original = jsonView({ extension: { arbitrary: ['a', 2, false, null] } });
		const expected = JSON.parse(JSON.stringify(original)) as NodeView;
		const converted = convertNodeView(original, 'md');
		expect(converted.source).toContain('manef-node-view-json');
		expect(convertNodeView(converted, 'json')).toEqual(expected);
		expect(original).toEqual(expected);
		const clone = convertNodeView(original, 'json') as NodeView & {
			extension: { arbitrary: unknown[] };
		};
		clone.extension.arbitrary.push('changed');
		expect(original).toEqual(expected);
	});

	it('uses collision-safe fences for backticks and preserves multiline titles', () => {
		const source = 'flowchart LR\n  A["``` and `````"] --> B["~~~"]';
		const original = jsonView({
			title: 'Title\n```manef-node-view-json\nwith collision',
			source: JSON.stringify({ source, unknown: '\n```manef-node-view-json\n' })
		});
		const converted = convertNodeView(original, 'md');
		expect(converted.source).toContain('``````mermaid\n');
		expect(isNodeView(converted)).toBe(true);
		expect(mermaidSource(converted)).toBe(source);
		expect(convertNodeView(converted, 'json')).toEqual(original);
	});

	it('treats a validated edited canonical JSON payload as authoritative', () => {
		const original = { ...createNodeView('sequence', 'Before'), custom: { text: 'before' } };
		const converted = convertNodeView(original, 'json');
		const payload = JSON.parse(converted.source) as { view: typeof original };
		payload.view.title = 'After';
		payload.view.custom.text = 'after';
		payload.view.source = payload.view.source.replace(
			'sequenceDiagram',
			'sequenceDiagram\n%% edited canonical source'
		);
		const edited = { ...payload.view, format: 'json' as const, source: JSON.stringify(payload) };
		expect(convertNodeView(edited, 'md')).toEqual(payload.view);
		expect(mermaidSource(edited)).toContain('%% edited canonical source');
	});

	it('accepts canonical Markdown metadata edits when the preview still agrees', () => {
		const original = jsonView({ metadata: { owner: 'before' } });
		const converted = convertNodeView(original, 'md');
		const edited = {
			...converted,
			metadata: { owner: 'after' },
			source: converted.source.replace('"owner": "before"', '"owner": "after"')
		};
		expect(convertNodeView(edited, 'json')).toEqual(jsonView({ metadata: { owner: 'after' } }));
	});

	it('rejects conflicting outer metadata instead of silently discarding edits', () => {
		const original = { ...createNodeView('flowchart', 'Before'), metadata: { owner: 'before' } };
		const converted = convertNodeView(original, 'json');
		for (const edited of [
			{ ...converted, title: 'Changed outer title' },
			{ ...converted, metadata: { owner: 'after' } },
			{ ...converted, addedOutsidePayload: true }
		]) {
			expect(isNodeView(edited)).toBe(false);
			expect(() => convertNodeView(edited, 'md')).toThrow('metadata does not match');
			expect(() => mermaidSource(edited)).toThrow('metadata does not match');
		}
		const payload = JSON.parse(converted.source) as { view: typeof original };
		payload.view.title = 'Changed canonical title';
		expect(() => convertNodeView({ ...converted, source: JSON.stringify(payload) }, 'md')).toThrow(
			'metadata does not match'
		);
	});

	it('rejects a changed preview and an inconsistent changed canonical source', () => {
		const converted = convertNodeView(jsonView(), 'md');
		const previewEdit = {
			...converted,
			source: converted.source.replace('A[Mulai]', 'A[Changed]')
		};
		expect(() => convertNodeView(previewEdit, 'json')).toThrow('does not match');
		expect(() => mermaidSource(previewEdit)).toThrow('does not match');
		expect(isNodeView(previewEdit)).toBe(false);
		const payloadEdit = {
			...converted,
			source: converted.source.replace('settings', 'preferences')
		};
		expect(convertNodeView(payloadEdit, 'json').source).toContain('preferences');
		const canonicalSourceEdit = {
			...converted,
			source: converted.source.replace('A[Mulai] --> B[Selesai]\\', 'A[Changed] --> B[Selesai]\\')
		};
		expect(() => mermaidSource(canonicalSourceEdit)).toThrow('does not match');
	});

	it('rejects multiple, unknown, malformed and unclosed canonical payloads', () => {
		const converted = convertNodeView(jsonView(), 'md');
		const duplicates = { ...converted, source: `${converted.source}\n${converted.source}` };
		expect(() => mermaidSource(duplicates)).toThrow('multiple canonical payloads');
		for (const source of [
			'```manef-node-view-json\n{}\n```\n',
			'```manef-node-view-json\nnot json\n```\n',
			'```manef-node-view-json\n{}\n',
			converted.source + '\nExtra content\n'
		]) {
			const invalid = { ...converted, source };
			expect(() => convertNodeView(invalid, 'json')).toThrow();
			expect(() => mermaidSource(invalid)).toThrow();
			expect(isNodeView(invalid)).toBe(false);
		}
	});

	it('rejects future versions, invalid views and unsupported wrapper data', () => {
		for (const source of [
			jsonEnvelope(jsonView(), 2),
			jsonEnvelope({ ...jsonView(), kind: 'future-diagram' }),
			jsonEnvelope(jsonView(), 1, { future: { preserved: false } }),
			'{"format":"manef-node-view","schemaVersion":1,"view":'
		]) {
			const invalid = { ...jsonView(), source };
			expect(isNodeView(invalid)).toBe(false);
			expect(() => mermaidSource(invalid)).toThrow();
			expect(() => convertNodeView(invalid, 'md')).toThrow();
		}
	});

	it('rejects nested wrappers before conversion or rendering', () => {
		const original = createNodeView('flowchart', 'Map');
		const converted = convertNodeView(original, 'json');
		const nested = { ...converted, source: jsonEnvelope(converted) };
		expect(isNodeView(nested)).toBe(false);
		expect(() => mermaidSource(nested)).toThrow('Nested');
		expect(() => convertNodeView(nested, 'md')).toThrow('Nested');
	});

	it('bounds authored source, serialized source, and metadata depth', () => {
		const original = { ...createNodeView('flowchart', 'Map'), source: 'x'.repeat(20_000) };
		const converted = convertNodeView(original, 'json');
		expect(converted.source.length).toBeGreaterThan(20_000);
		expect(isNodeView(converted)).toBe(true);
		expect(convertNodeView(converted, 'md')).toEqual(original);
		expect(() => convertNodeView({ ...original, source: original.source + 'x' }, 'json')).toThrow(
			'20,000'
		);
		expect(() =>
			mermaidSource({ ...original, source: 'x'.repeat(MAX_NODE_VIEW_SOURCE_LENGTH + 1) })
		).toThrow('size limit');
		let metadata: unknown = 'deep';
		for (let index = 0; index < 25; index++) metadata = { child: metadata };
		expect(() => convertNodeView(jsonView({ metadata }), 'md')).toThrow('nested too deeply');
	});

	it('rejects metadata that JSON serialization would silently discard or alter', () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		class AlteredArray extends Array<string> {
			toJSON() {
				return ['replacement'];
			}
		}
		const inheritedToJson = Object.assign(['original'], {});
		Object.setPrototypeOf(inheritedToJson, { toJSON: () => ['replacement'] });
		for (const metadata of [
			undefined,
			Number.NaN,
			-0,
			Number.MAX_SAFE_INTEGER + 1,
			1n,
			new Date(),
			circular,
			[undefined],
			new Array(2),
			new AlteredArray('original'),
			inheritedToJson
		]) {
			const view = jsonView({ metadata });
			expect(isNodeView(view)).toBe(false);
			expect(() => convertNodeView(view, 'md')).toThrow();
		}
	});
});
