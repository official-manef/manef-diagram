import type {
	ArchitectureEdge,
	ArchitectureGraph,
	ArchitectureNode,
	ArchitecturePort
} from '../types';
import { validateGraph } from './graph';

export function patchNode(
	graph: ArchitectureGraph,
	id: string,
	patch: Partial<ArchitectureNode>
): ArchitectureGraph {
	return {
		...graph,
		nodes: graph.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node))
	};
}

export function patchPort(
	graph: ArchitectureGraph,
	nodeId: string,
	direction: 'inputs' | 'outputs',
	portId: string,
	patch: Partial<ArchitecturePort>
): ArchitectureGraph {
	const node = graph.nodes.find((item) => item.id === nodeId);
	if (!node) return graph;
	return patchNode(graph, nodeId, {
		[direction]: node[direction].map((port) => (port.id === portId ? { ...port, ...patch } : port))
	} as Partial<ArchitectureNode>);
}

export function appendPort(
	graph: ArchitectureGraph,
	nodeId: string,
	direction: 'inputs' | 'outputs'
): ArchitectureGraph {
	const node = graph.nodes.find((item) => item.id === nodeId);
	if (!node) return graph;
	const prefix = direction === 'inputs' ? 'in' : 'out';
	const index = node[direction].length + 1;
	return patchNode(graph, nodeId, {
		[direction]: [...node[direction], { id: `${prefix}-${index}`, label: `${prefix} ${index}` }]
	} as Partial<ArchitectureNode>);
}

export function withoutPort(
	graph: ArchitectureGraph,
	nodeId: string,
	direction: 'inputs' | 'outputs',
	portId: string
): ArchitectureGraph {
	return {
		...graph,
		nodes: graph.nodes.map((item) =>
			item.id === nodeId
				? { ...item, [direction]: item[direction].filter((port) => port.id !== portId) }
				: item
		),
		edges: graph.edges.filter((edge) =>
			direction === 'inputs'
				? !(edge.target === nodeId && edge.targetPort === portId)
				: !(edge.source === nodeId && edge.sourcePort === portId)
		)
	};
}

export function createNode(graph: ArchitectureGraph): ArchitectureNode {
	const baseId = `node-${graph.nodes.length + 1}`;
	let id = baseId;
	let suffix = 1;
	while (graph.nodes.some((node) => node.id === id)) id = `${baseId}-${suffix++}`;
	return {
		id,
		label: 'New node',
		subtitle: 'Describe this architecture item',
		tags: ['custom'],
		status: 'proposed',
		level: 3,
		inputs: [{ id: 'in', label: 'Consumes' }],
		outputs: [{ id: 'out', label: 'Provides' }]
	};
}

/** Returns null when the retargeted connection is invalid or already exists. */
export function withEdgePatch(
	graph: ArchitectureGraph,
	edge: ArchitectureEdge,
	patch: Partial<ArchitectureEdge>
): ArchitectureGraph | null {
	const nextEdge = { ...edge, ...patch };
	if (patch.source) {
		const source = graph.nodes.find((node) => node.id === nextEdge.source);
		if (!source?.outputs.some((port) => port.id === nextEdge.sourcePort)) {
			nextEdge.sourcePort = source?.outputs[0]?.id ?? nextEdge.sourcePort;
		}
	}
	if (patch.target) {
		const target = graph.nodes.find((node) => node.id === nextEdge.target);
		if (!target?.inputs.some((port) => port.id === nextEdge.targetPort)) {
			nextEdge.targetPort = target?.inputs[0]?.id ?? nextEdge.targetPort;
		}
	}
	const next = {
		...graph,
		edges: graph.edges.map((item) => (item.id === nextEdge.id ? nextEdge : item))
	};
	return validateGraph(next) ? next : null;
}
