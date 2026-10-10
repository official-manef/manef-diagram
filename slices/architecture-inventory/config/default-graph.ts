import type {
	ArchitectureEdge,
	ArchitectureGraph,
	ArchitectureNode,
	InventoryItem
} from '../types';

const ports = () => ({
	inputs: [{ id: 'in', label: 'Consumes' }],
	outputs: [{ id: 'out', label: 'Provides' }]
});

function node(
	id: string,
	label: string,
	subtitle: string,
	level: number,
	status: ArchitectureNode['status'] = 'active',
	tags: string[] = ['manef']
): ArchitectureNode {
	return { id, label, subtitle, level, status, tags, ...ports() };
}

function link(id: string, source: string, target: string, label: string): ArchitectureEdge {
	return { id, source, sourcePort: 'out', target, targetPort: 'in', label };
}

function part(id: string, label: string, subtitle: string, level: number): ArchitectureNode {
	return node(id, label, subtitle, level, 'active', ['kind:component']);
}

/** What this repository actually ships. Not a map of private infrastructure. */
function diagramProduct(): ArchitectureGraph {
	return {
		schemaVersion: 1,
		nodes: [
			part('directory', 'Public directory', 'Home, products, guide, audit', 0),
			part('canvas', 'Public map', 'The /app canvas', 1),
			part('workspace', 'Demo workspace', 'Local simulation only', 1),
			part('contract', 'Graph contract', 'Nodes, ports, edges, ten tools', 2),
			part('mcp', 'MCP read API', 'Rejects anonymous calls', 2)
		],
		edges: [
			link('directory-canvas', 'directory', 'canvas', 'opens'),
			link('directory-workspace', 'directory', 'workspace', 'opens demo'),
			link('canvas-contract', 'canvas', 'contract', 'renders'),
			link('workspace-contract', 'workspace', 'contract', 'simulates'),
			link('mcp-contract', 'mcp', 'contract', 'reads')
		]
	};
}

const architectureNode = node(
	'architecture',
	'diagram.manef.dev',
	'Interactive architecture + agent context graph',
	2,
	'active',
	[
		'manef',
		'architecture',
		'product',
		'project:manef-diagram',
		'platform:vercel',
		'kind:context-graph'
	]
);
architectureNode.child = diagramProduct();

export const defaultGraph: ArchitectureGraph = {
	schemaVersion: 1,
	nodes: [
		node('manef', 'MANEF', 'Product studio and technology ecosystem', 0, 'active', [
			'manef',
			'brand'
		]),
		node('manef-dev', 'manef.dev', 'Canonical MANEF product domain', 1, 'active', [
			'manef',
			'domain'
		]),
		architectureNode,
		node('mso', 'mso.manef.dev', 'Manef Shell OS', 2, 'active', [
			'manef',
			'product',
			'ai',
			'project:mso',
			'kind:product'
		]),
		node('models', 'models.manef.dev', 'Model catalog and routing', 2, 'proposed', [
			'manef',
			'product',
			'ai'
		]),
		node('connectors', 'connectors.manef.dev', 'Integration and connector gateway', 2, 'proposed', [
			'manef',
			'infra'
		]),
		node(
			'registry',
			'registry.manef.dev',
			'Apps, agents, tools and feature registry',
			2,
			'proposed',
			['manef', 'product']
		),
		node('docs', 'docs.manef.dev', 'Shared product documentation', 2, 'proposed', [
			'manef',
			'docs'
		]),
		node('ops', 'ops.manef.dev', 'Private operator surface', 2, 'private', [
			'manef',
			'infra',
			'private'
		]),
		node('directory', 'Directory', 'Public pages', 3, 'active', ['module']),
		node('canvas', 'Canvas', 'The public map', 3, 'active', ['module']),
		node('workspace', 'Workspace', 'Local demo', 3, 'active', ['module']),
		node('contract', 'Contract', 'Nodes and edges', 3, 'active', ['module']),
		node('mcp', 'MCP', 'Read API', 3, 'active', ['module']),
		node('shell', 'Shell', 'MSO frame', 3, 'active', ['module']),
		node('sessions', 'Sessions', 'Signed-in state', 3, 'active', ['module']),
		node('catalog', 'Catalog', 'Model list', 3, 'active', ['module']),
		node('routing', 'Routing', 'Model choice', 3, 'active', ['module']),
		node('sign-in', 'Sign-in', 'Account entry', 3, 'active', ['module']),
		node('webhooks', 'Webhooks', 'Inbound events', 3, 'active', ['module']),
		node('agents', 'Agents', 'Registered agents', 3, 'active', ['module']),
		node('tools', 'Tools', 'Registered tools', 3, 'active', ['module']),
		node('guide', 'Guide', 'Public docs', 3, 'active', ['module'])
	],
	edges: [
		{
			id: 'brand-domain',
			source: 'manef',
			sourcePort: 'out',
			target: 'manef-dev',
			targetPort: 'in',
			label: 'canonical domain'
		},
		{
			id: 'domain-architecture',
			source: 'manef-dev',
			sourcePort: 'out',
			target: 'architecture',
			targetPort: 'in',
			label: 'context graph'
		},
		{
			id: 'domain-mso',
			source: 'manef-dev',
			sourcePort: 'out',
			target: 'mso',
			targetPort: 'in',
			label: 'shell'
		},
		{
			id: 'domain-models',
			source: 'manef-dev',
			sourcePort: 'out',
			target: 'models',
			targetPort: 'in',
			label: 'model catalog'
		},
		{
			id: 'domain-connectors',
			source: 'manef-dev',
			sourcePort: 'out',
			target: 'connectors',
			targetPort: 'in',
			label: 'infrastructure'
		},
		{
			id: 'domain-registry',
			source: 'manef-dev',
			sourcePort: 'out',
			target: 'registry',
			targetPort: 'in',
			label: 'registry'
		},
		{
			id: 'domain-docs',
			source: 'manef-dev',
			sourcePort: 'out',
			target: 'docs',
			targetPort: 'in',
			label: 'documentation'
		},
		{
			id: 'domain-ops',
			source: 'manef-dev',
			sourcePort: 'out',
			target: 'ops',
			targetPort: 'in',
			label: 'private operations'
		},
		link('arch-directory', 'architecture', 'directory', 'lists pages'),
		link('arch-canvas', 'architecture', 'canvas', 'draws the map'),
		link('arch-workspace', 'architecture', 'workspace', 'opens the demo'),
		link('arch-contract', 'architecture', 'contract', 'defines the map'),
		link('arch-mcp', 'architecture', 'mcp', 'reads the map'),
		link('mso-shell', 'mso', 'shell', 'frames the shell'),
		link('mso-sessions', 'mso', 'sessions', 'keeps a session'),
		link('models-catalog', 'models', 'catalog', 'lists models'),
		link('models-routing', 'models', 'routing', 'chooses a model'),
		link('connectors-signin', 'connectors', 'sign-in', 'starts sign-in'),
		link('connectors-webhooks', 'connectors', 'webhooks', 'receives events'),
		link('registry-agents', 'registry', 'agents', 'indexes agents'),
		link('registry-tools', 'registry', 'tools', 'indexes tools'),
		link('docs-guide', 'docs', 'guide', 'explains the product')
	]
};

export const defaultInventory: InventoryItem[] = [
	{
		id: 'open-silong',
		label: 'Open Silong',
		subtitle: 'Knowledge graph patterns reused as a framework-neutral reference',
		tags: ['reference', 'graph', 'knowledge', 'kind:reference', 'source:github'],
		kind: 'reference',
		status: 'active'
	},
	{
		id: 'convex-cloud',
		label: 'Convex Cloud',
		subtitle: 'Optional managed realtime persistence adapter',
		tags: ['backend', 'convex', 'cloud', 'platform:convex', 'kind:backend'],
		kind: 'reference',
		status: 'active'
	},
	{
		id: 'dokploy',
		label: 'Dokploy',
		subtitle: 'Optional Node/container host via adapter-node; not the current production origin',
		tags: ['deploy', 'infra', 'platform:dokploy', 'kind:deployment'],
		kind: 'reference',
		status: 'active'
	}
];
