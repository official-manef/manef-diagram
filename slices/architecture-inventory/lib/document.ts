import type { ArchitectureGraph, DiagramMode, InventoryItem, Point, TraceMode } from '../types';
import { mermaidSource } from './diagram-views';
import { cloneGraph, validateGraph } from './graph';
import { cloneJson, isJsonValue } from './json';

export { cloneJson, isJsonValue, sameJson } from './json';
export type { JsonObject, JsonValue } from './json';

export const MAX_DOCUMENT_INPUT_CHARS = 5_000_000;
export const DOCUMENT_MARKDOWN_LANGUAGE = 'manef-diagram-json';

export type DiagramDocumentUi = {
	themePreset?: 'system' | 'composio-light' | 'composio-dark';
	diagramMode?: DiagramMode;
	traceMode?: TraceMode;
	focusMode?: boolean;
	query?: string;
	tags?: string[];
	seeds?: string[];
	open?: string[];
	pan?: Point;
	zoom?: number;
	positions?: Record<string, Point>;
	layouts?: Record<string, Record<string, Point>>;
	[key: string]: unknown;
};

export type DiagramDocument = {
	format: 'manef-diagram';
	schemaVersion: 1;
	title: string;
	graph: ArchitectureGraph;
	ui?: DiagramDocumentUi;
	inventory?: InventoryItem[];
	[key: string]: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isPoint(value: unknown): value is Point {
	return (
		isRecord(value) &&
		typeof value.x === 'number' &&
		Number.isFinite(value.x) &&
		typeof value.y === 'number' &&
		Number.isFinite(value.y)
	);
}

function isPositions(value: unknown): value is Record<string, Point> {
	return isRecord(value) && Object.values(value).every(isPoint);
}

function isUi(value: unknown): value is DiagramDocumentUi {
	if (!isRecord(value)) return false;
	if (
		value.themePreset !== undefined &&
		(typeof value.themePreset !== 'string' ||
			!['system', 'composio-light', 'composio-dark'].includes(value.themePreset))
	)
		return false;
	if (
		value.diagramMode !== undefined &&
		value.diagramMode !== 'flow' &&
		value.diagramMode !== 'graph'
	)
		return false;
	if (
		value.traceMode !== undefined &&
		value.traceMode !== 'direct' &&
		value.traceMode !== 'component'
	)
		return false;
	if (value.focusMode !== undefined && typeof value.focusMode !== 'boolean') return false;
	if (value.query !== undefined && typeof value.query !== 'string') return false;
	for (const key of ['tags', 'seeds', 'open']) {
		if (value[key] !== undefined && !stringList(value[key])) return false;
	}
	if (value.pan !== undefined && !isPoint(value.pan)) return false;
	if (
		value.zoom !== undefined &&
		(typeof value.zoom !== 'number' || !Number.isFinite(value.zoom) || value.zoom <= 0)
	)
		return false;
	if (value.positions !== undefined && !isPositions(value.positions)) return false;
	if (
		value.layouts !== undefined &&
		(!isRecord(value.layouts) || !Object.values(value.layouts).every(isPositions))
	)
		return false;
	return true;
}

function isInventory(value: unknown): value is InventoryItem[] {
	if (!Array.isArray(value)) return false;
	const ids = new Set<string>();
	for (const item of value as unknown[]) {
		if (
			!isRecord(item) ||
			typeof item.id !== 'string' ||
			item.id.length === 0 ||
			ids.has(item.id) ||
			typeof item.label !== 'string' ||
			!stringList(item.tags)
		)
			return false;
		if (
			item.kind !== undefined &&
			(typeof item.kind !== 'string' ||
				!['reference', 'repo', 'domain', 'hostname', 'convex'].includes(item.kind))
		)
			return false;
		const node = {
			...item,
			inputs: item.inputs === undefined ? [] : item.inputs,
			outputs: item.outputs === undefined ? [] : item.outputs
		};
		if (!validateGraph({ schemaVersion: 1, nodes: [node], edges: [] })) return false;
		ids.add(item.id);
	}
	return true;
}

export function validateDiagramDocument(value: unknown): value is DiagramDocument {
	return (
		isJsonValue(value) &&
		isRecord(value) &&
		value.format === 'manef-diagram' &&
		value.schemaVersion === 1 &&
		typeof value.title === 'string' &&
		validateGraph(value.graph) &&
		(value.ui === undefined || isUi(value.ui)) &&
		(value.inventory === undefined || isInventory(value.inventory))
	);
}

function requireDocument(value: unknown): asserts value is DiagramDocument {
	if (!isJsonValue(value)) {
		throw new Error(
			'Document must use plain JSON values with finite numbers, safe integers, and no negative zero. Encode larger integers as strings.'
		);
	}
	if (!validateDiagramDocument(value)) {
		throw new Error(
			'Document does not match the MANEF diagram document contract (version 1, a valid graph, and JSON-safe fields are required).'
		);
	}
	boundedInput(fenced(JSON.stringify(value), DOCUMENT_MARKDOWN_LANGUAGE));
}

function boundedInput(text: string): void {
	if (text.length > MAX_DOCUMENT_INPUT_CHARS) {
		throw new Error('Diagram document exceeds the 5,000,000 character limit.');
	}
}

export function createDocument(
	graph: ArchitectureGraph,
	title = 'MANEF Architecture'
): DiagramDocument {
	const document: DiagramDocument = {
		format: 'manef-diagram',
		schemaVersion: 1,
		title,
		graph: cloneGraph(graph)
	};
	requireDocument(document);
	return document;
}

export function cloneDocument(document: DiagramDocument): DiagramDocument {
	requireDocument(document);
	return cloneJson(document);
}

/** Legacy bare graphs and untagged envelopes migrate without discarding their fields. */
export function parseDiagramDocument(json: string): DiagramDocument {
	boundedInput(json);
	const value: unknown = JSON.parse(json);
	if (isRecord(value) && 'format' in value && value.format !== 'manef-diagram') {
		throw new Error('Unsupported diagram document format.');
	}
	if (isRecord(value) && ('format' in value || 'graph' in value)) {
		if ('nodes' in value || 'edges' in value) {
			throw new Error('Ambiguous diagram document: put graph nodes and edges inside graph.');
		}
		if (value.schemaVersion !== undefined && value.schemaVersion !== 1) {
			throw new Error('Unsupported diagram document version.');
		}
		const document = {
			...value,
			format: 'manef-diagram',
			schemaVersion: 1,
			title: value.title === undefined ? 'MANEF Architecture' : value.title
		};
		requireDocument(document);
		return cloneJson(document);
	}
	if (!validateGraph(value)) {
		throw new Error('JSON is not a MANEF diagram document or architecture graph.');
	}
	return createDocument(value);
}

export function documentAsJson(document: DiagramDocument): string {
	requireDocument(document);
	const text = JSON.stringify(document, null, 2);
	return text.length <= MAX_DOCUMENT_INPUT_CHARS ? text : JSON.stringify(document);
}

function fenced(source: string, language: string): string {
	let run = 0;
	let length = 3;
	for (let index = 0; index < source.length; index += 1) {
		run = source.charCodeAt(index) === 96 ? run + 1 : 0;
		length = Math.max(length, run + 1);
	}
	const marker = '\x60'.repeat(length);
	return marker + language + '\n' + source + (source.endsWith('\n') ? '' : '\n') + marker;
}

function heading(text: string): string {
	return text.replace(/[\r\n]+/g, ' ').trim();
}

/** Readable projections accompany one authoritative payload; projections are never re-parsed as data. */
export function documentAsMarkdown(document: DiagramDocument): string {
	const payload = documentAsJson(document);
	const parts = [
		'# ' + heading(document.title),
		'The canonical JSON block preserves the complete document. The diagrams below are readable projections.'
	];
	let projectionBudget = 50_000;
	function graphSummary(graph: ArchitectureGraph, path: string[]): void {
		if (projectionBudget <= 0) return;
		const label = path.length ? path.join(' / ') : 'Architecture';
		parts.push('## ' + heading(label));
		const aliases = new Map(graph.nodes.map((node, index) => [node.id, 'n' + index]));
		const lines = ['flowchart LR'];
		for (const node of graph.nodes) {
			lines.push('  ' + aliases.get(node.id) + '[' + JSON.stringify(node.label) + ']');
		}
		for (const edge of graph.edges) {
			lines.push('  ' + aliases.get(edge.source) + ' --> ' + aliases.get(edge.target));
		}
		const projection = fenced(lines.join('\n'), 'mermaid');
		if (projection.length <= projectionBudget) {
			parts.push(projection);
			projectionBudget -= projection.length;
		}
		for (const node of graph.nodes) {
			for (const view of node.views ?? []) {
				parts.push('### ' + heading([...path, node.label, view.title].join(' / ')));
				try {
					const source = fenced(mermaidSource(view), 'mermaid');
					if (source.length <= projectionBudget) {
						parts.push(source);
						projectionBudget -= source.length;
					} else {
						parts.push('This view is preserved in the canonical JSON block.');
					}
				} catch {
					parts.push('This authored view is preserved in the canonical JSON block.');
				}
			}
			if (node.child) graphSummary(node.child, [...path, node.label]);
		}
	}
	graphSummary(document.graph, []);
	parts.push('## Canonical document', fenced(payload, DOCUMENT_MARKDOWN_LANGUAGE));
	const text = parts.join('\n\n') + '\n';
	if (text.length <= MAX_DOCUMENT_INPUT_CHARS) return text;
	// Readable projections and indentation are optional; the authoritative payload is not.
	return fenced(JSON.stringify(document), DOCUMENT_MARKDOWN_LANGUAGE);
}

export function parseDiagramMarkdown(markdown: string): DiagramDocument {
	boundedInput(markdown);
	const payloads: string[] = [];
	let fence: { marker: string; length: number; canonical: boolean; lines: string[] } | null = null;
	for (const line of markdown.split(/\r?\n/)) {
		if (fence) {
			const closing = new RegExp('^ {0,3}' + fence.marker + '{' + fence.length + ',}[ \\t]*$');
			if (closing.test(line)) {
				if (fence.canonical) payloads.push(fence.lines.join('\n'));
				fence = null;
			} else if (fence.canonical) {
				fence.lines.push(line);
			}
			continue;
		}
		const opening = /^ {0,3}(\x60{3,}|~{3,})(.*)$/.exec(line);
		if (!opening) continue;
		// A backtick fence's info string cannot itself contain a backtick.
		if (opening[1][0] === String.fromCharCode(96) && opening[2].includes(String.fromCharCode(96)))
			continue;
		fence = {
			marker: opening[1][0],
			length: opening[1].length,
			canonical: opening[2].trim() === DOCUMENT_MARKDOWN_LANGUAGE,
			lines: []
		};
	}
	if (fence?.canonical) throw new Error('The canonical diagram JSON block is not closed.');
	if (payloads.length !== 1) {
		throw new Error(
			'Markdown must contain exactly one manef-diagram-json block. A plain Mermaid diagram cannot preserve the complete document.'
		);
	}
	return parseDiagramDocument(payloads[0]);
}
