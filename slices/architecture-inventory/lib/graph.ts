import type {
	ArchitectureEdge,
	ArchitectureGraph,
	ArchitectureNode,
	DiagramMode,
	Point,
	TraceMode,
	TraceResult
} from '../types';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isPort(value: unknown): boolean {
	return (
		isRecord(value) &&
		typeof value.id === 'string' &&
		value.id.length > 0 &&
		typeof value.label === 'string'
	);
}

function connectionKey(edge: ArchitectureEdge): string {
	return `${edge.source}:${edge.sourcePort}>${edge.target}:${edge.targetPort}`;
}

export function validateGraph(value: unknown): value is ArchitectureGraph {
	if (
		!isRecord(value) ||
		value.schemaVersion !== 1 ||
		!Array.isArray(value.nodes) ||
		!Array.isArray(value.edges)
	) {
		return false;
	}

	const nodes = value.nodes as unknown[];
	const edges = value.edges as unknown[];
	const nodeIds = new Set<string>();
	const nodeMap = new Map<string, ArchitectureNode>();

	for (const raw of nodes) {
		if (
			!isRecord(raw) ||
			typeof raw.id !== 'string' ||
			raw.id.length === 0 ||
			nodeIds.has(raw.id) ||
			typeof raw.label !== 'string' ||
			!Array.isArray(raw.tags) ||
			!raw.tags.every((tag) => typeof tag === 'string') ||
			!Array.isArray(raw.inputs) ||
			!raw.inputs.every(isPort) ||
			!Array.isArray(raw.outputs) ||
			!raw.outputs.every(isPort)
		) {
			return false;
		}
		nodeIds.add(raw.id);
		nodeMap.set(raw.id, raw as ArchitectureNode);
	}

	const edgeIds = new Set<string>();
	const connections = new Set<string>();
	for (const raw of edges) {
		if (
			!isRecord(raw) ||
			typeof raw.id !== 'string' ||
			raw.id.length === 0 ||
			edgeIds.has(raw.id) ||
			typeof raw.source !== 'string' ||
			typeof raw.sourcePort !== 'string' ||
			typeof raw.target !== 'string' ||
			typeof raw.targetPort !== 'string'
		) {
			return false;
		}
		const edge = raw as ArchitectureEdge;
		const source = nodeMap.get(edge.source);
		const target = nodeMap.get(edge.target);
		if (
			!source?.outputs.some((port) => port.id === edge.sourcePort) ||
			!target?.inputs.some((port) => port.id === edge.targetPort)
		) {
			return false;
		}
		const key = connectionKey(edge);
		if (connections.has(key)) return false;
		edgeIds.add(edge.id);
		connections.add(key);
	}

	return true;
}

export function parseGraphJson(json: string): ArchitectureGraph {
	const value: unknown = JSON.parse(json);
	if (!validateGraph(value))
		throw new Error('JSON does not match the MANEF architecture graph contract.');
	return cloneGraph(value);
}

export function cloneGraph(graph: ArchitectureGraph): ArchitectureGraph {
	return {
		schemaVersion: 1,
		nodes: graph.nodes.map((node) => ({
			...node,
			tags: [...node.tags],
			inputs: node.inputs.map((port) => ({ ...port })),
			outputs: node.outputs.map((port) => ({ ...port }))
		})),
		edges: graph.edges.map((edge) => ({ ...edge, tags: edge.tags ? [...edge.tags] : undefined }))
	};
}

export function dedupeEdges(edges: ArchitectureEdge[]): ArchitectureEdge[] {
	const seen = new Set<string>();
	return edges.filter((edge) => {
		const key = connectionKey(edge);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export function addEdge(graph: ArchitectureGraph, edge: ArchitectureEdge): ArchitectureGraph {
	if (graph.edges.some((current) => connectionKey(current) === connectionKey(edge))) return graph;
	const next = {
		...cloneGraph(graph),
		edges: [...graph.edges.map((item) => ({ ...item })), { ...edge }]
	};
	return validateGraph(next) ? next : graph;
}

export function adjacency(graph: ArchitectureGraph): Map<string, Set<string>> {
	const map = new Map(graph.nodes.map((node) => [node.id, new Set<string>()]));
	for (const edge of graph.edges) {
		map.get(edge.source)?.add(edge.target);
		map.get(edge.target)?.add(edge.source);
	}
	return map;
}

export function traceGraph(
	graph: ArchitectureGraph,
	seeds: string[],
	mode: TraceMode = 'component'
): TraceResult {
	const validSeeds = seeds.filter((id) => graph.nodes.some((node) => node.id === id));
	if (validSeeds.length === 0) return { nodeIds: [], edgeIds: [] };

	const nodeIds = new Set(validSeeds);
	if (mode === 'direct') {
		for (const edge of graph.edges) {
			if (validSeeds.includes(edge.source) || validSeeds.includes(edge.target)) {
				nodeIds.add(edge.source);
				nodeIds.add(edge.target);
			}
		}
	} else {
		const neighbors = adjacency(graph);
		const queue = [...validSeeds];
		while (queue.length > 0) {
			const current = queue.shift()!;
			for (const next of neighbors.get(current) ?? []) {
				if (!nodeIds.has(next)) {
					nodeIds.add(next);
					queue.push(next);
				}
			}
		}
	}

	const edgeIds = graph.edges
		.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
		.map((edge) => edge.id);
	return { nodeIds: [...nodeIds], edgeIds };
}

export const flowCard = { width: 200, height: 148, gapX: 64, gapY: 18 } as const;

function columnHeight(count: number) {
	return count * flowCard.height + Math.max(0, count - 1) * flowCard.gapY;
}

function layoutFlow(graph: ArchitectureGraph): Record<string, Point> {
	const levels = new Map<number, ArchitectureNode[]>();
	for (const node of graph.nodes) {
		const level = node.level ?? 3;
		const list = levels.get(level) ?? [];
		list.push(node);
		levels.set(level, list);
	}
	const columns = [...levels.keys()].sort((a, b) => a - b).map((level) => levels.get(level)!);
	const maxHeight = Math.max(
		...columns.map((nodes) => columnHeight(nodes.length)),
		flowCard.height
	);
	const points: Record<string, Point> = {};
	columns.forEach((nodes, column) => {
		const startY = 36 + (maxHeight - columnHeight(nodes.length)) / 2;
		nodes.forEach((node, index) => {
			points[node.id] = {
				x: 36 + column * (flowCard.width + flowCard.gapX),
				y: startY + index * (flowCard.height + flowCard.gapY)
			};
		});
	});
	return points;
}

function layoutRadial(graph: ArchitectureGraph): Record<string, Point> {
	const degree = new Map(graph.nodes.map((node) => [node.id, 0]));
	for (const edge of graph.edges) {
		degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
		degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
	}
	const hub =
		[...graph.nodes].sort(
			(a, b) =>
				(degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) ||
				(a.level ?? 3) - (b.level ?? 3) ||
				a.label.localeCompare(b.label)
		)[0] ?? graph.nodes[0];
	const others = graph.nodes.filter((node) => node.id !== hub?.id);
	const count = Math.max(others.length, 1);
	const radius = Math.max(360, flowCard.width + 96 + count * 16);
	const center = { x: 980, y: 760 };
	const points: Record<string, Point> = {};
	if (hub) {
		points[hub.id] = {
			x: center.x - flowCard.width / 2,
			y: center.y - flowCard.height / 2
		};
	}
	others.forEach((node, index) => {
		const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
		points[node.id] = {
			x: center.x + Math.cos(angle) * radius - flowCard.width / 2,
			y: center.y + Math.sin(angle) * radius - flowCard.height / 2
		};
	});
	return points;
}

export function layoutGraph(graph: ArchitectureGraph, mode: DiagramMode): Record<string, Point> {
	if (graph.nodes.length === 0) return {};
	return mode === 'graph' ? layoutRadial(graph) : layoutFlow(graph);
}

export type EdgeRoute = {
	id: string;
	d: string;
	label: string;
	x: number;
	y: number;
	points: Point[];
};

function borderToward(from: Point, to: Point): Point {
	const cx = from.x + flowCard.width / 2;
	const cy = from.y + flowCard.height / 2;
	const tx = to.x + flowCard.width / 2;
	const ty = to.y + flowCard.height / 2;
	const dx = tx - cx;
	const dy = ty - cy;
	const scale =
		1 / Math.max(Math.abs(dx) / (flowCard.width / 2), Math.abs(dy) / (flowCard.height / 2), 0.0001);
	return { x: cx + dx * scale, y: cy + dy * scale };
}

function flowPoints(source: Point, target: Point, index: number, total: number): Point[] {
	const usable = flowCard.height - 24;
	const y1 = source.y + 12 + ((index + 0.5) * usable) / Math.max(total, 1);
	const y2 = target.y + flowCard.height / 2;
	const x1 = source.x + flowCard.width;
	const x2 = target.x;
	if (x2 - x1 < 24) {
		const above = Math.min(source.y, target.y) - 28;
		return [
			{ x: x1, y: y1 },
			{ x: x1, y: above },
			{ x: x2, y: above },
			{ x: x2, y: y2 }
		];
	}
	const bus = x1 + Math.max(28, Math.min(46, (x2 - x1) / 2));
	return [
		{ x: x1, y: y1 },
		{ x: bus, y: y1 },
		{ x: bus, y: y2 },
		{ x: x2, y: y2 }
	];
}

function pathFrom(points: Point[]): string {
	return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

export function routeEdges(
	graph: ArchitectureGraph,
	positions: Record<string, Point>,
	mode: DiagramMode
): EdgeRoute[] {
	const bySource = new Map<string, ArchitectureEdge[]>();
	for (const edge of graph.edges) {
		const list = bySource.get(edge.source) ?? [];
		list.push(edge);
		bySource.set(edge.source, list);
	}
	return graph.edges.flatMap((edge) => {
		const source = positions[edge.source];
		const target = positions[edge.target];
		if (!source || !target) return [];
		const siblings = bySource.get(edge.source) ?? [edge];
		const index = Math.max(
			0,
			siblings.findIndex((item) => item.id === edge.id)
		);
		const points =
			mode === 'graph'
				? [borderToward(source, target), borderToward(target, source)]
				: flowPoints(source, target, index, siblings.length);
		const labelAt = points[Math.min(points.length - 1, mode === 'graph' ? 0 : 2)];
		const end = points[points.length - 1];
		const labelX =
			mode === 'graph' ? points[0].x + (end.x - points[0].x) * 0.68 : (labelAt.x + end.x) / 2;
		const labelY = mode === 'graph' ? points[0].y + (end.y - points[0].y) * 0.68 - 8 : end.y - 8;
		return [
			{
				id: edge.id,
				d: pathFrom(points),
				label: edge.label?.trim() || 'connects',
				x: labelX,
				y: labelY,
				points
			}
		];
	});
}

export function sameGraph(a: ArchitectureGraph, b: ArchitectureGraph): boolean {
	const signature = (graph: ArchitectureGraph) =>
		JSON.stringify({
			nodes: graph.nodes.map((node) => ({
				id: node.id,
				label: node.label,
				subtitle: node.subtitle ?? '',
				level: node.level ?? null,
				status: node.status ?? null,
				tags: node.tags,
				inputs: node.inputs.map((port) => port.label),
				outputs: node.outputs.map((port) => port.label)
			})),
			edges: graph.edges.map((edge) => ({
				id: edge.id,
				source: edge.source,
				target: edge.target,
				label: edge.label ?? ''
			}))
		});
	return signature(a) === signature(b);
}
