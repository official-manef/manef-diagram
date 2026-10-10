import type {
	ArchitectureEdge,
	ArchitectureGraph,
	ArchitectureNode,
	DiagramMode,
	Point,
	TraceMode,
	TraceResult
} from '../types';

export const MAX_DIAGRAM_DEPTH = 3;

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
	return validateGraphAt(value, 0);
}

function validateGraphAt(value: unknown, depth: number): value is ArchitectureGraph {
	if (depth > MAX_DIAGRAM_DEPTH) return false;
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
			!raw.outputs.every(isPort) ||
			(raw.child !== undefined && !validateGraphAt(raw.child, depth + 1))
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

/** Accept a bare graph or a document that wraps one in `graph`. The graph contract stays version 1. */
export function parseImportedGraph(json: string): ArchitectureGraph {
	const value: unknown = JSON.parse(json);
	if (isRecord(value) && 'graph' in value) {
		if (!validateGraph(value.graph)) {
			throw new Error('JSON does not match the MANEF architecture graph contract.');
		}
		return cloneGraph(value.graph);
	}
	if (!validateGraph(value))
		throw new Error('JSON does not match the MANEF architecture graph contract.');
	return cloneGraph(value);
}

export function cloneGraph(graph: ArchitectureGraph): ArchitectureGraph {
	return {
		schemaVersion: 1,
		nodes: graph.nodes.map((node) => {
			const copy: ArchitectureNode = {
				...node,
				tags: [...node.tags],
				inputs: node.inputs.map((port) => ({ ...port })),
				outputs: node.outputs.map((port) => ({ ...port }))
			};
			if (node.child) copy.child = cloneGraph(node.child);
			else delete copy.child;
			return copy;
		}),
		edges: graph.edges.map((edge) => ({ ...edge, tags: edge.tags ? [...edge.tags] : undefined }))
	};
}

/** The diagram reached by opening each id, or null when any step has no child. */
export function diagramAt(
	graph: ArchitectureGraph,
	path: readonly string[]
): ArchitectureGraph | null {
	let current = graph;
	for (const id of path) {
		const next = current.nodes.find((node) => node.id === id)?.child;
		if (!next) return null;
		current = next;
	}
	return current;
}

/** Replace the diagram at path. Returns the same graph when the path or the next diagram is invalid. */
export function writeDiagram(
	graph: ArchitectureGraph,
	path: readonly string[],
	next: ArchitectureGraph
): ArchitectureGraph {
	if (!validateGraph(next)) return graph;
	if (path.length === 0) return cloneGraph(next);
	const [id, ...rest] = path;
	if (!graph.nodes.some((node) => node.id === id && node.child)) return graph;
	return cloneGraph({
		...graph,
		nodes: graph.nodes.map((node) =>
			node.id === id && node.child ? { ...node, child: writeDiagram(node.child, rest, next) } : node
		)
	});
}

export function blankChild(label: string): ArchitectureGraph {
	const name = label.trim() || 'this node';
	return {
		schemaVersion: 1,
		nodes: [
			{
				id: 'component',
				label: 'Component',
				subtitle: `Part of ${name}`.slice(0, 160),
				tags: ['kind:component'],
				status: 'proposed',
				level: 1,
				inputs: [{ id: 'in', label: 'Consumes' }],
				outputs: [{ id: 'out', label: 'Provides' }]
			}
		],
		edges: []
	};
}

export function linkCount(graph: ArchitectureGraph, id: string): number {
	return graph.edges.reduce(
		(count, edge) => count + (edge.source === id || edge.target === id ? 1 : 0),
		0
	);
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

export const flowCard = { width: 204, height: 138, gapX: 176, gapY: 18 } as const;
/** Graph mode draws an Obsidian-style dot. Positions in that mode are the dot center. */
export const graphDot = { radius: 5 } as const;

/** Bigger dots have more links, the same way Obsidian sizes a note. */
export function graphNodeRadius(linkCount: number): number {
	return 3.5 + Math.min(4.5, Math.max(0, linkCount) * 0.7);
}
const flowRows = 4;

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
	const lanes: ArchitectureNode[][] = [];
	for (const level of [...levels.keys()].sort((a, b) => a - b)) {
		const nodes = levels.get(level)!;
		const rows = Math.min(flowRows, Math.max(nodes.length, 1));
		for (let index = 0; index < nodes.length; index += rows) {
			lanes.push(nodes.slice(index, index + rows));
		}
	}
	const maxHeight = Math.max(...lanes.map((nodes) => columnHeight(nodes.length)), flowCard.height);
	const points: Record<string, Point> = {};
	lanes.forEach((nodes, lane) => {
		const startY = 32 + (maxHeight - columnHeight(nodes.length)) / 2;
		const x = 24 + lane * (flowCard.width + flowCard.gapX);
		nodes.forEach((node, index) => {
			points[node.id] = {
				x,
				y: startY + index * (flowCard.height + flowCard.gapY)
			};
		});
	});
	return points;
}

function layoutRadial(graph: ArchitectureGraph): Record<string, Point> {
	const core = graph.nodes.filter((node) => (node.level ?? 3) < 3);
	const placed = core.length > 0 ? core : graph.nodes;
	const degree = new Map(placed.map((node) => [node.id, 0]));
	for (const edge of graph.edges) {
		if (!degree.has(edge.source) || !degree.has(edge.target)) continue;
		degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
		degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
	}
	const hub =
		[...placed].sort(
			(a, b) =>
				(degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) ||
				(a.level ?? 3) - (b.level ?? 3) ||
				a.label.localeCompare(b.label)
		)[0] ?? placed[0];
	const others = placed.filter((node) => node.id !== hub?.id);
	const count = Math.max(others.length, 1);
	const radius = Math.max(280, 180 + count * 36);
	const center = { x: 980, y: 760 };
	const points: Record<string, Point> = {};
	if (hub) points[hub.id] = { x: center.x, y: center.y };
	others.forEach((node, index) => {
		const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
		points[node.id] = {
			x: center.x + Math.cos(angle) * radius,
			y: center.y + Math.sin(angle) * radius
		};
	});
	const extras = graph.nodes.filter((node) => !points[node.id]);
	const satellites = new Map<string, ArchitectureNode[]>();
	for (const node of extras) {
		const edge = graph.edges.find((item) => item.source === node.id || item.target === node.id);
		const anchor = edge ? (edge.source === node.id ? edge.target : edge.source) : hub?.id;
		const list = satellites.get(anchor ?? '') ?? [];
		list.push(node);
		satellites.set(anchor ?? '', list);
	}
	for (const [anchorId, nodes] of satellites) {
		const anchor = points[anchorId] ?? center;
		const orbit = 72 + nodes.length * 14;
		nodes.forEach((node, index) => {
			const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(nodes.length, 1);
			points[node.id] = {
				x: anchor.x + Math.cos(angle) * orbit,
				y: anchor.y + Math.sin(angle) * orbit
			};
		});
	}
	return points;
}

export function layoutGraph(graph: ArchitectureGraph, mode: DiagramMode): Record<string, Point> {
	if (graph.nodes.length === 0) return {};
	return mode === 'graph' ? layoutRadial(graph) : layoutFlow(graph);
}

/** One step of the graph-mode force layout used by Settle. */
export function settleTick(
	graph: ArchitectureGraph,
	positions: Record<string, Point>,
	velocity: Record<string, Point> = {}
): { positions: Record<string, Point>; velocity: Record<string, Point> } {
	const ids = graph.nodes.map((node) => node.id).filter((id) => positions[id]);
	const force = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));
	for (let left = 0; left < ids.length; left += 1) {
		for (let right = left + 1; right < ids.length; right += 1) {
			const a = positions[ids[left]];
			const b = positions[ids[right]];
			let dx = a.x - b.x;
			let dy = a.y - b.y;
			let distanceSquared = dx * dx + dy * dy;
			if (distanceSquared < 1) distanceSquared = 1;
			const distance = Math.sqrt(distanceSquared);
			const push = 28000 / distanceSquared;
			dx /= distance;
			dy /= distance;
			const forceA = force.get(ids[left]);
			const forceB = force.get(ids[right]);
			if (!forceA || !forceB) continue;
			forceA.x += dx * push;
			forceA.y += dy * push;
			forceB.x -= dx * push;
			forceB.y -= dy * push;
		}
	}
	for (const edge of graph.edges) {
		const a = positions[edge.source];
		const b = positions[edge.target];
		const forceA = force.get(edge.source);
		const forceB = force.get(edge.target);
		if (!a || !b || !forceA || !forceB) continue;
		let dx = b.x - a.x;
		let dy = b.y - a.y;
		const distance = Math.sqrt(dx * dx + dy * dy) || 1;
		const pull = (distance - 150) * 0.02;
		dx /= distance;
		dy /= distance;
		forceA.x += dx * pull;
		forceA.y += dy * pull;
		forceB.x -= dx * pull;
		forceB.y -= dy * pull;
	}
	const nextPositions = { ...positions };
	const nextVelocity: Record<string, Point> = { ...velocity };
	for (const id of ids) {
		const current = positions[id];
		const motion = velocity[id] ?? { x: 0, y: 0 };
		const applied = force.get(id) ?? { x: 0, y: 0 };
		applied.x += (980 - current.x) * 0.012;
		applied.y += (760 - current.y) * 0.012;
		const next = {
			x: (motion.x + applied.x) * 0.72,
			y: (motion.y + applied.y) * 0.72
		};
		const speed = Math.hypot(next.x, next.y);
		if (speed > 14) {
			next.x *= 14 / speed;
			next.y *= 14 / speed;
		}
		nextVelocity[id] = next;
		nextPositions[id] = { x: current.x + next.x, y: current.y + next.y };
	}
	return { positions: nextPositions, velocity: nextVelocity };
}

export type EdgeRoute = {
	id: string;
	d: string;
	label: string;
	x: number;
	y: number;
	points: Point[];
};

function graphLine(
	source: Point,
	target: Point,
	sourceRadius: number = graphDot.radius,
	targetRadius: number = graphDot.radius
): Point[] {
	const dx = target.x - source.x;
	const dy = target.y - source.y;
	const distance = Math.hypot(dx, dy) || 1;
	const sourceInset = Math.min(sourceRadius + 1.5, Math.max(0, distance / 2 - 1));
	const targetInset = Math.min(targetRadius + 1.5, Math.max(0, distance / 2 - 1));
	return [
		{ x: source.x + (dx / distance) * sourceInset, y: source.y + (dy / distance) * sourceInset },
		{ x: target.x - (dx / distance) * targetInset, y: target.y - (dy / distance) * targetInset }
	];
}

function labelHitsNode(
	box: { left: number; right: number; top: number; bottom: number },
	origin: Point,
	mode: DiagramMode
) {
	if (mode === 'graph') {
		const pad = graphDot.radius + 6;
		return (
			box.right > origin.x - pad &&
			box.left < origin.x + pad &&
			box.bottom > origin.y - pad &&
			box.top < origin.y + pad
		);
	}
	return (
		box.right > origin.x + 2 &&
		box.left < origin.x + flowCard.width - 2 &&
		box.bottom > origin.y + 2 &&
		box.top < origin.y + flowCard.height - 2
	);
}

function pathFrom(points: Point[]): string {
	return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function cubicPoint(start: Point, control1: Point, control2: Point, end: Point, t: number): Point {
	const rest = 1 - t;
	return {
		x:
			rest * rest * rest * start.x +
			3 * rest * rest * t * control1.x +
			3 * rest * t * t * control2.x +
			t * t * t * end.x,
		y:
			rest * rest * rest * start.y +
			3 * rest * rest * t * control1.y +
			3 * rest * t * t * control2.y +
			t * t * t * end.y
	};
}

function portAnchor(
	origin: Point,
	direction: 'inputs' | 'outputs',
	index: number,
	count: number
): Point {
	const safeCount = Math.max(count, 1);
	return {
		x: origin.x + (direction === 'outputs' ? flowCard.width : 0),
		y: origin.y + 18 + ((index + 1) / (safeCount + 1)) * (flowCard.height - 36)
	};
}

function samplesHit(points: Point[], obstacles: Point[]) {
	for (let segment = 1; segment < points.length; segment += 1) {
		const start = points[segment - 1];
		const end = points[segment];
		for (let step = 0; step <= 12; step += 1) {
			const t = step / 12;
			const point = {
				x: start.x + (end.x - start.x) * t,
				y: start.y + (end.y - start.y) * t
			};
			if (obstacles.some((box) => pointInsideCard(point, box))) return true;
		}
	}
	return false;
}

function pointInsideCard(point: Point, box: Point) {
	return (
		point.x > box.x + 6 &&
		point.x < box.x + flowCard.width - 6 &&
		point.y > box.y + 6 &&
		point.y < box.y + flowCard.height - 6
	);
}

function curveThrough(
	start: Point,
	end: Point,
	bend: number,
	controlY: { start: number; end: number } | null
): { d: string; points: Point[] } {
	const control1 = { x: start.x + bend, y: controlY?.start ?? start.y };
	const control2 = { x: end.x - bend, y: controlY?.end ?? end.y };
	const points = Array.from({ length: 13 }, (_, step) =>
		cubicPoint(start, control1, control2, end, step / 12)
	);
	return {
		d: `M ${start.x} ${start.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${end.x} ${end.y}`,
		points
	};
}

/** Flow curves match the inventory HTML: a cubic bend from the output side to the input side. */
function flowCurve(
	source: Point,
	target: Point,
	sourceIndex: number,
	sourceCount: number,
	targetIndex: number,
	targetCount: number,
	obstacles: Point[]
): { d: string; points: Point[] } {
	const start = portAnchor(source, 'outputs', sourceIndex, sourceCount);
	const end = portAnchor(target, 'inputs', targetIndex, targetCount);
	const bend = Math.max(60, Math.abs(end.x - start.x) * 0.42);
	const direct = curveThrough(start, end, bend, null);
	if (!samplesHit(direct.points, obstacles)) return direct;
	const roof = Math.min(start.y, end.y, ...obstacles.map((box) => box.y));
	const over = curveThrough(start, end, 0, { start: roof - 64, end: roof - 64 });
	if (!samplesHit(over.points, obstacles)) return over;
	const crossed = obstacles.filter(
		(box) => box.x + flowCard.width > Math.min(start.x, end.x) && box.x < Math.max(start.x, end.x)
	);
	const crossedRoof = Math.min(...crossed.map((box) => box.y), start.y, end.y);
	for (const extra of [72, 120, 180, 260, 420]) {
		const clearance = crossedRoof - extra;
		const tucked = curveThrough(start, end, 72, { start: clearance, end: clearance });
		if (!samplesHit(tucked.points, obstacles)) return tucked;
	}
	return curveThrough(start, end, 0, { start: roof - 220, end: roof - 220 });
}

export function routeEdges(
	graph: ArchitectureGraph,
	positions: Record<string, Point>,
	mode: DiagramMode
): EdgeRoute[] {
	return graph.edges.flatMap((edge) => {
		const source = positions[edge.source];
		const target = positions[edge.target];
		if (!source || !target) return [];
		const obstacles = graph.nodes
			.filter((node) => node.id !== edge.source && node.id !== edge.target)
			.map((node) => positions[node.id])
			.filter((point): point is Point => Boolean(point));
		const sourceNode = graph.nodes.find((node) => node.id === edge.source);
		const targetNode = graph.nodes.find((node) => node.id === edge.target);
		const sourcePorts = sourceNode?.outputs ?? [];
		const targetPorts = targetNode?.inputs ?? [];
		const sourceIndex = Math.max(
			0,
			sourcePorts.findIndex((port) => port.id === edge.sourcePort)
		);
		const targetIndex = Math.max(
			0,
			targetPorts.findIndex((port) => port.id === edge.targetPort)
		);
		const curved =
			mode === 'flow'
				? flowCurve(
						source,
						target,
						sourceIndex,
						Math.max(sourcePorts.length, 1),
						targetIndex,
						Math.max(targetPorts.length, 1),
						obstacles
					)
				: null;
		const points = curved
			? curved.points
			: graphLine(
					source,
					target,
					graphNodeRadius(linkCount(graph, edge.source)),
					graphNodeRadius(linkCount(graph, edge.target))
				);
		const end = points[points.length - 1];
		if (mode === 'graph') {
			const dx = end.x - points[0].x;
			const dy = end.y - points[0].y;
			const length = Math.hypot(dx, dy) || 1;
			return [
				{
					id: edge.id,
					d: pathFrom(points),
					label: edge.label?.trim() || 'connects',
					x: (points[0].x + end.x) / 2 + (-dy / length) * 14,
					y: (points[0].y + end.y) / 2 + (dx / length) * 14,
					points
				}
			];
		}
		const midpoint = points[Math.floor(points.length / 2)] ?? points[0];
		const cards = graph.nodes
			.map((node) => positions[node.id])
			.filter((point): point is Point => Boolean(point));
		const labelHits = (point: Point) => {
			const textWidth = (edge.label?.trim() || 'connects').length * 7.2;
			const box = {
				left: point.x - textWidth / 2,
				right: point.x + textWidth / 2,
				top: point.y - 14,
				bottom: point.y + 2
			};
			return cards.some((card) => labelHitsNode(box, card, mode));
		};
		const labelPoint = [midpoint, ...[...points].sort((a, b) => a.y - b.y)].find(
			(point) => !labelHits(point)
		) ?? { x: (points[0].x + end.x) / 2, y: Math.min(...points.map((point) => point.y)) - 16 };
		const labelX = labelPoint.x;
		const labelY = labelPoint.y;
		return [
			{
				id: edge.id,
				d: curved ? curved.d : pathFrom(points),
				label: edge.label?.trim() || 'connects',
				x: labelX,
				y: labelY,
				points
			}
		];
	});
}

export function sameGraph(a: ArchitectureGraph, b: ArchitectureGraph): boolean {
	const signature = (graph: ArchitectureGraph): string =>
		JSON.stringify({
			nodes: graph.nodes.map((node) => ({
				id: node.id,
				label: node.label,
				subtitle: node.subtitle ?? '',
				level: node.level ?? null,
				status: node.status ?? null,
				tags: node.tags,
				inputs: node.inputs.map((port) => port.label),
				outputs: node.outputs.map((port) => port.label),
				child: node.child ? signature(node.child) : '',
				inventoryRef: node.inventoryRef ? `${node.inventoryRef.kind}:${node.inventoryRef.key}` : ''
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

/** Keep an edge when a filter matches either end, and name the other end as context. */
export function relatedView(graph: ArchitectureGraph, matchedIds: readonly string[]) {
	const matched = new Set(matchedIds);
	const edges = graph.edges.filter((edge) => matched.has(edge.source) || matched.has(edge.target));
	const context = new Set<string>();
	for (const edge of edges) {
		if (!matched.has(edge.source)) context.add(edge.source);
		if (!matched.has(edge.target)) context.add(edge.target);
	}
	return {
		edges,
		contextIds: [...context],
		nodeIds: graph.nodes
			.filter((node) => matched.has(node.id) || context.has(node.id))
			.map((node) => node.id)
	};
}
