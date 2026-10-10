import type { ArchitectureGraph, ArchitectureNode, InventoryItem, InventoryKind } from '../types';

export function searchInventory(
	items: InventoryItem[],
	query: string,
	activeTags: string[] = [],
	kind?: InventoryKind
): InventoryItem[] {
	const needle = query.trim().toLowerCase();
	return items.filter((item) => {
		const text = [item.id, item.label, item.subtitle ?? '', ...item.tags].join(' ').toLowerCase();
		return (
			(!kind || item.kind === kind) &&
			(!needle || text.includes(needle)) &&
			activeTags.every((tag) => item.tags.includes(tag))
		);
	});
}

export function inventoryCount(items: InventoryItem[], kind: InventoryKind): number {
	return items.filter((item) => item.kind === kind).length;
}

const INVENTORY_FILTERS = ['all', 'reference', 'repo', 'domain', 'hostname', 'convex'] as const;
export type InventoryFilter = (typeof INVENTORY_FILTERS)[number];

export function parseInventoryFilter(value: string): InventoryFilter | null {
	return (INVENTORY_FILTERS as readonly string[]).includes(value)
		? (value as InventoryFilter)
		: null;
}

function sameInventory(node: ArchitectureNode, item: InventoryItem) {
	if (node.id === item.id) return true;
	return Boolean(
		item.kind && node.inventoryRef?.kind === item.kind && node.inventoryRef.key === item.id
	);
}

export function materializeInventoryItem(item: InventoryItem): ArchitectureNode {
	const node: ArchitectureNode = {
		id: item.id,
		label: item.label,
		subtitle: item.subtitle,
		tags: [...item.tags],
		group: item.group,
		status: item.status,
		inputs: item.inputs?.map((port) => ({ ...port })) ?? [{ id: 'in', label: 'Consumes' }],
		outputs: item.outputs?.map((port) => ({ ...port })) ?? [{ id: 'out', label: 'Provides' }]
	};
	if (item.kind) node.inventoryRef = { kind: item.kind, key: item.id };
	return node;
}

export function addInventoryItem(graph: ArchitectureGraph, item: InventoryItem): ArchitectureGraph {
	if (graph.nodes.some((node) => sameInventory(node, item))) return graph;
	return { ...graph, nodes: [...graph.nodes, materializeInventoryItem(item)] };
}
