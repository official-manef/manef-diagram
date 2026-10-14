import type { DemoEdge, DemoNode, WorkspaceState } from './logic';

export type WorkspaceSnapshot = {
	active: string;
	workspaces: Record<string, WorkspaceState>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasStrings(value: Record<string, unknown>, fields: string[]): boolean {
	return fields.every((field) => typeof value[field] === 'string');
}

function isStrings(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function areUniqueRecords(value: unknown, fields: string[]): boolean {
	if (!Array.isArray(value)) return false;
	const ids = new Set<string>();
	return value.every((item: unknown) => {
		if (!isRecord(item) || !hasStrings(item, ['id', ...fields]) || typeof item.id !== 'string') {
			return false;
		}
		if (!item.id || ids.has(item.id)) return false;
		ids.add(item.id);
		return true;
	});
}

function isDemoNode(value: unknown): value is DemoNode {
	return (
		isRecord(value) &&
		hasStrings(value, ['id', 'label', 'kind', 'platform', 'agent', 'project', 'status', 'notes']) &&
		typeof value.id === 'string' &&
		value.id.length > 0 &&
		typeof value.x === 'number' &&
		Number.isFinite(value.x) &&
		typeof value.y === 'number' &&
		Number.isFinite(value.y) &&
		isStrings(value.tags)
	);
}

function isDemoEdge(value: unknown): value is DemoEdge {
	return (
		isRecord(value) &&
		hasStrings(value, ['id', 'source', 'target', 'label']) &&
		typeof value.id === 'string' &&
		value.id.length > 0
	);
}

/** Browser storage is untrusted input, even when this application originally wrote it. */
function isWorkspaceState(value: unknown): value is WorkspaceState {
	if (
		!isRecord(value) ||
		value.schemaVersion !== 1 ||
		typeof value.workspace !== 'string' ||
		!isRecord(value.profile) ||
		typeof value.profile.signedIn !== 'boolean' ||
		!hasStrings(value.profile, ['role', 'name']) ||
		!isStrings(value.apps) ||
		!isRecord(value.connections) ||
		!Object.values(value.connections).every((connected) => typeof connected === 'boolean') ||
		!isRecord(value.routing) ||
		!hasStrings(value.routing, ['primary', 'fallback', 'policy']) ||
		!areUniqueRecords(value.activities, ['text', 'time', 'type']) ||
		!areUniqueRecords(value.runs, ['text']) ||
		!areUniqueRecords(value.domains, ['host', 'note']) ||
		(value.reviews !== undefined && !isStrings(value.reviews)) ||
		!isRecord(value.graph) ||
		!Array.isArray(value.graph.nodes) ||
		!value.graph.nodes.every(isDemoNode) ||
		!Array.isArray(value.graph.edges) ||
		!value.graph.edges.every(isDemoEdge)
	) {
		return false;
	}
	const nodeIds = new Set(value.graph.nodes.map((node) => node.id));
	const edgeIds = new Set(value.graph.edges.map((edge) => edge.id));
	return (
		nodeIds.size === value.graph.nodes.length &&
		edgeIds.size === value.graph.edges.length &&
		value.graph.edges.every((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
	);
}

/** Return only a complete, consistent snapshot; leave damaged storage available for recovery. */
export function restoreWorkspaceSnapshot(value: unknown): WorkspaceSnapshot | null {
	if (
		!isRecord(value) ||
		typeof value.active !== 'string' ||
		!isRecord(value.workspaces) ||
		!Object.hasOwn(value.workspaces, value.active)
	) {
		return null;
	}
	const entries = Object.entries(value.workspaces);
	if (
		!entries.every(
			([name, workspace]) => isWorkspaceState(workspace) && workspace.workspace === name
		)
	) {
		return null;
	}
	return { active: value.active, workspaces: value.workspaces as Record<string, WorkspaceState> };
}
