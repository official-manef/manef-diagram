export type ArchitecturePort = {
	id: string;
	label: string;
	kind?: string;
};

export type NodeStatus = 'active' | 'proposed' | 'private';

export type NodeView = {
	id: string;
	kind: string;
	title: string;
	format: 'md' | 'json';
	source: string;
};

export type ArchitectureNode = {
	id: string;
	label: string;
	subtitle?: string;
	tags: string[];
	group?: string;
	status?: NodeStatus;
	level?: number;
	inputs: ArchitecturePort[];
	outputs: ArchitecturePort[];
	/** Another diagram of this same contract. Absent when the node has no components. */
	child?: ArchitectureGraph;
	/** Extra Mermaid diagrams for this node, authored as Markdown or JSON. */
	views?: NodeView[];
	/** Set when this node was added from the inventory, so the same record is not added twice. */
	inventoryRef?: InventoryRef;
};

export type ArchitectureEdge = {
	id: string;
	source: string;
	sourcePort: string;
	target: string;
	targetPort: string;
	label?: string;
	tags?: string[];
};

export type ArchitectureGraph = {
	schemaVersion: 1;
	nodes: ArchitectureNode[];
	edges: ArchitectureEdge[];
};

export type InventoryKind = 'reference' | 'repo' | 'domain' | 'hostname' | 'convex';

export type InventoryRef = {
	kind: InventoryKind;
	key: string;
};

export type InventoryItem = {
	id: string;
	label: string;
	subtitle?: string;
	tags: string[];
	group?: string;
	status?: NodeStatus;
	kind?: InventoryKind;
	inputs?: ArchitecturePort[];
	outputs?: ArchitecturePort[];
};

export type TraceMode = 'direct' | 'component';
export type DiagramMode = 'flow' | 'graph';

export type TraceResult = {
	nodeIds: string[];
	edgeIds: string[];
};

export type Point = { x: number; y: number };
