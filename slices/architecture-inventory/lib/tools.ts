import type { ArchitectureGraph, DiagramMode, InventoryItem, TraceMode } from '../types';
import { adjacency, layoutGraph, traceGraph, validateGraph } from './graph';
import { searchInventory } from './inventory';
import { buildDiagramViewUrl, tagsMatchFacets } from './share';

export const GRAPH_TOOL_NAMES = [
	'graph_status',
	'graph_list_nodes',
	'graph_list_edges',
	'graph_trace',
	'graph_layout',
	'graph_search_inventory',
	'graph_adjacency',
	'graph_query',
	'graph_build_view',
	'graph_create_portable_view'
] as const;

export type GraphToolName = (typeof GRAPH_TOOL_NAMES)[number];

function text(value: unknown) {
	return typeof value === 'string' ? value : '';
}

function stringList(value: unknown) {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === 'string')
		: [];
}

function modeOf(value: unknown): DiagramMode {
	return value === 'flow' ? 'flow' : 'graph';
}

function traceOf(value: unknown): TraceMode {
	return value === 'direct' ? 'direct' : 'component';
}

export function isGraphToolName(value: string): value is GraphToolName {
	return (GRAPH_TOOL_NAMES as readonly string[]).includes(value);
}

/**
 * One read-only execution of the public graph tools.
 * Callers choose the graph and inventory. This function does not persist anything.
 */
export function runGraphTool(
	graph: ArchitectureGraph,
	inventory: InventoryItem[],
	tool: string,
	args: Record<string, unknown>
): unknown {
	if (!validateGraph(graph)) throw new Error('Graph does not match the MANEF graph contract.');
	if (!isGraphToolName(tool)) throw new Error('Unknown tool.');

	if (tool === 'graph_status') {
		return {
			schemaVersion: graph.schemaVersion,
			nodeCount: graph.nodes.length,
			edgeCount: graph.edges.length
		};
	}
	if (tool === 'graph_list_nodes') {
		const tag = text(args.tag);
		const status = text(args.status);
		return graph.nodes.filter(
			(node) =>
				(!tag || node.tags.includes(tag)) && (!status || (node.status ?? 'active') === status)
		);
	}
	if (tool === 'graph_list_edges') return graph.edges;
	if (tool === 'graph_trace') {
		const seeds = stringList(args.seeds);
		if (!seeds.length) throw new Error('seeds must be an array of strings.');
		return traceGraph(graph, seeds, traceOf(args.mode));
	}
	if (tool === 'graph_layout') return layoutGraph(graph, args.mode === 'graph' ? 'graph' : 'flow');
	if (tool === 'graph_search_inventory') return searchInventory(inventory, text(args.query));
	if (tool === 'graph_adjacency') {
		return Object.fromEntries([...adjacency(graph)].map(([id, set]) => [id, [...set]]));
	}
	if (tool === 'graph_query') {
		const needle = text(args.query).trim().toLowerCase();
		const tags = stringList(args.tags);
		const status = text(args.status);
		const nodes = graph.nodes.filter((node) => {
			const textMatch =
				!needle ||
				[node.label, node.subtitle ?? '', ...node.tags].join(' ').toLowerCase().includes(needle);
			return (
				textMatch &&
				tagsMatchFacets(node.tags, tags) &&
				(!status || (node.status ?? 'active') === status)
			);
		});
		const nodeIds = new Set(nodes.map((node) => node.id));
		const edges = graph.edges.filter(
			(edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
		);
		return {
			nodes,
			edges,
			viewUrl: buildDiagramViewUrl({
				graph: { schemaVersion: 1, nodes, edges },
				seeds: [],
				mode: 'graph',
				trace: 'component',
				focus: false
			})
		};
	}
	if (tool === 'graph_build_view') {
		return {
			url: buildDiagramViewUrl({
				query: text(args.query),
				tags: stringList(args.tags),
				seeds: stringList(args.seeds),
				mode: modeOf(args.mode),
				trace: traceOf(args.trace),
				focus: args.focus === true
			})
		};
	}
	const supplied = args.graph === undefined ? graph : args.graph;
	if (!validateGraph(supplied)) throw new Error('Graph does not match the MANEF graph contract.');
	return {
		url: buildDiagramViewUrl({
			graph: supplied,
			query: text(args.query),
			tags: stringList(args.tags),
			seeds: stringList(args.seeds),
			mode: modeOf(args.mode),
			trace: traceOf(args.trace),
			focus: args.focus === true
		}),
		nodeCount: supplied.nodes.length,
		edgeCount: supplied.edges.length,
		persisted: false
	};
}
