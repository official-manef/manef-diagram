import type { ArchitectureGraph, DiagramMode, TraceMode, FlowDirection } from '../types';
import { cloneGraph, parseGraphJson, validateGraph } from './graph';
import { isJsonValue } from './json';

export const DEFAULT_DIAGRAM_ORIGIN = 'https://diagram.manef.dev';
export const PORTABLE_GRAPH_MAX_CHARS = 12_000;
// Count the complete percent-encoded request target, not decoded JSON characters.
// Leave room below common 16 KiB request-line limits for the method/version overhead.
export const PORTABLE_VIEW_MAX_REQUEST_BYTES = 16_000;

function requireRequestBudget(target: string): void {
	// URL.pathname/search and URLSearchParams serialization are ASCII here: one char = one byte.
	if (target.length > PORTABLE_VIEW_MAX_REQUEST_BYTES) {
		throw new Error(
			`Portable view exceeds the shared-link size limit (${PORTABLE_VIEW_MAX_REQUEST_BYTES} encoded request-target bytes). Export JSON or Markdown instead.`
		);
	}
}

export type DiagramView = {
	graph?: ArchitectureGraph;
	query: string;
	tags: string[];
	seeds: string[];
	open: string[];
	mode: DiagramMode;
	flowDirection: FlowDirection;
	trace: TraceMode;
	focus: boolean;
};

export function tagGroup(tag: string): string {
	const separator = tag.indexOf(':');
	return separator > 0 ? tag.slice(0, separator) : 'general';
}

export function tagsMatchFacets(nodeTags: string[], selectedTags: string[]): boolean {
	if (selectedTags.length === 0) return true;
	const groups = new Map<string, string[]>();
	for (const tag of selectedTags) {
		const group = tagGroup(tag);
		groups.set(group, [...(groups.get(group) ?? []), tag]);
	}
	return [...groups.values()].every((tags) => tags.some((tag) => nodeTags.includes(tag)));
}

export function buildDiagramViewUrl(
	view: Partial<DiagramView> & { graph?: ArchitectureGraph },
	origin = DEFAULT_DIAGRAM_ORIGIN
): string {
	const url = new URL('/app', origin);
	if (view.query?.trim()) url.searchParams.set('q', view.query.trim());
	for (const tag of view.tags ?? []) url.searchParams.append('tag', tag);
	for (const seed of view.seeds ?? []) url.searchParams.append('seed', seed);
	if (view.mode) url.searchParams.set('mode', view.mode);
	if (view.flowDirection && view.flowDirection !== 'LR')
		url.searchParams.set('direction', view.flowDirection);
	if (view.trace) url.searchParams.set('trace', view.trace);
	if (view.focus) url.searchParams.set('focus', '1');
	for (const id of view.open ?? []) url.searchParams.append('open', id);
	if (view.graph) {
		if (!isJsonValue(view.graph)) {
			throw new Error(
				'Graph must use plain JSON values with finite numbers, safe integers, and no negative zero. Encode larger integers as strings.'
			);
		}
		if (!validateGraph(view.graph))
			throw new Error('Graph does not match the MANEF graph contract.');
		const payload = JSON.stringify(view.graph);
		if (payload.length > PORTABLE_GRAPH_MAX_CHARS) {
			throw new Error(
				`Portable graph is too large for a navigable URL (max ${PORTABLE_GRAPH_MAX_CHARS} characters).`
			);
		}
		url.searchParams.set('graph', payload);
	}
	requireRequestBudget(url.pathname + url.search);
	return url.toString();
}

export function parseDiagramView(search: string): DiagramView {
	const raw = search && !search.startsWith('?') ? '?' + search : search;
	requireRequestBudget('/app' + raw);
	const params = new URLSearchParams(search);
	const encoded = params.toString();
	requireRequestBudget('/app' + (encoded ? '?' + encoded : ''));
	const graphPayload = params.get('graph');
	if (graphPayload && graphPayload.length > PORTABLE_GRAPH_MAX_CHARS) {
		throw new Error('Portable graph exceeds the shared-link size limit.');
	}
	const mode = params.get('mode');
	const trace = params.get('trace');
	const direction = params.get('direction');
	return {
		graph: graphPayload ? cloneGraph(parseGraphJson(graphPayload)) : undefined,
		query: params.get('q') ?? '',
		tags: params.getAll('tag'),
		seeds: params.getAll('seed'),
		open: params.getAll('open'),
		mode: mode === 'graph' ? 'graph' : 'flow',
		flowDirection:
			direction === 'RL' || direction === 'TB' || direction === 'BT' ? direction : 'LR',
		trace: trace === 'component' ? 'component' : 'direct',
		focus: params.get('focus') === '1'
	};
}
