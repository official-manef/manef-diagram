export type DemoNode = {
	id: string;
	label: string;
	kind: string;
	x: number;
	y: number;
	platform: string;
	agent: string;
	project: string;
	status: string;
	notes: string;
	tags: string[];
};

export type DemoEdge = { id: string; source: string; target: string; label: string };

export type WorkspaceState = {
	schemaVersion: 1;
	workspace: string;
	profile: { signedIn: boolean; role: string; name: string };
	apps: string[];
	connections: Record<string, boolean>;
	routing: { primary: string; fallback: string; policy: string };
	activities: { id: string; text: string; time: string; type: string }[];
	runs: { id: string; text: string }[];
	domains: { id: string; host: string; note: string }[];
	reviews?: string[];
	graph: { nodes: DemoNode[]; edges: DemoEdge[] };
};

export type CatalogApp = {
	id: string;
	name: string;
	type: 'managed' | 'connected';
	category: string;
	description: string;
	permissions: string[];
	label: string;
};

export const catalog: CatalogApp[] = [
	{
		id: 'hermes',
		name: 'Hermes',
		type: 'managed',
		category: 'Agents',
		description:
			'Managed catalog entry. A production install has to go through a reviewed MSO adapter. This button only simulates that.',
		permissions: ['Local runtime', 'Workspace storage'],
		label: 'Managed adapter'
	},
	{
		id: 'openclaw',
		name: 'OpenClaw',
		type: 'managed',
		category: 'Agents',
		description:
			'Managed agent entry. This prototype only simulates the lifecycle and the permission review.',
		permissions: ['Local runtime', 'Outbound network'],
		label: 'Managed adapter'
	},
	{
		id: '9router',
		name: '9Router',
		type: 'managed',
		category: 'Routing',
		description:
			'Managed routing entry. Provider routing here uses demo data, not a live model API.',
		permissions: ['Local runtime', 'Provider configuration'],
		label: 'Managed adapter'
	},
	{
		id: 'n8n',
		name: 'n8n',
		type: 'connected',
		category: 'Automation',
		description: 'Connect an existing n8n instance. This template does not install n8n.',
		permissions: ['Open a reviewed instance'],
		label: 'Connection template'
	}
];

export const connectorCatalog = [
	{ id: 'github', name: 'GitHub', category: 'Source control' },
	{ id: 'vercel', name: 'Vercel', category: 'Deployment' },
	{ id: 'cloudflare', name: 'Cloudflare', category: 'Domains & edge' },
	{ id: 'convex', name: 'Convex', category: 'Backend' },
	{ id: 'hostinger', name: 'Hostinger', category: 'Infrastructure' },
	{ id: 'resend', name: 'Resend', category: 'Email' },
	{ id: 'google', name: 'Google', category: 'Workspace & analytics' },
	{ id: 'workos', name: 'WorkOS', category: 'Identity · design target' },
	{ id: 'batonly', name: 'Batonly', category: 'Companion · project delivery' },
	{ id: 'airin', name: 'AIRIN', category: 'External support integration' }
] as const;

export const mcpTools = [
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

const note = 'Synthetic demo record. It is not production data and it is not on the public map.';

function node(
	id: string,
	label: string,
	kind: string,
	x: number,
	y: number,
	platform: string,
	agent: string,
	notes: string
): DemoNode {
	return {
		id,
		label,
		kind,
		x,
		y,
		platform,
		agent,
		project: 'launch-demo',
		status: 'active',
		notes,
		tags: [`project:launch-demo`, `platform:${platform}`, `agent:${agent}`, `kind:${kind}`]
	};
}

export function createDemoState(name = 'Product studio'): WorkspaceState {
	return {
		schemaVersion: 1,
		workspace: name,
		profile: { signedIn: false, role: 'owner', name: 'Demo builder' },
		apps: [],
		connections: { github: true, vercel: true },
		routing: {
			primary: 'OpenRouter · demo',
			fallback: 'Local runtime · demo',
			policy: 'Balanced'
		},
		activities: [
			{
				id: 'seed1',
				text: 'Demo workspace is ready. Nothing here calls a live service.',
				time: 'Demo seed',
				type: 'system'
			},
			{
				id: 'seed2',
				text: 'GitHub and Vercel are marked connected as sample flags only.',
				time: 'Demo seed',
				type: 'connection'
			}
		],
		runs: [],
		domains: [],
		reviews: [],
		graph: {
			nodes: [
				node(
					'manef',
					'MANEF project',
					'project',
					40,
					220,
					'web',
					'builder',
					'Shared brief: connect tools and context without mixing this demo into the public map.'
				),
				node(
					'mso',
					'MSO runtime',
					'product',
					280,
					40,
					'local',
					'operator',
					'Where a demo app would appear after a simulated install.'
				),
				node(
					'diagram',
					'Diagram',
					'product',
					280,
					220,
					'web',
					'builder',
					'The public map stays at /app. This node is the demo workspace graph.'
				),
				node(
					'github',
					'GitHub',
					'service',
					280,
					400,
					'cloud',
					'builder',
					'Sample connection. No GitHub API request is made.'
				),
				node(
					'decision-1',
					'Public ≠ private',
					'decision',
					540,
					40,
					'web',
					'reviewer',
					'The public landing uses the public seed. This workspace is not that seed.'
				),
				node(
					'context-1',
					'Launch checklist',
					'document',
					540,
					220,
					'web',
					'builder',
					'Review sign-in, the public diagram, and catalog lifecycle before calling any of it production.'
				),
				node(
					'vercel',
					'Vercel',
					'service',
					540,
					400,
					'cloud',
					'operator',
					'Sample node. The factual deployment snapshot stays on the Audit page.'
				),
				node(
					'workos',
					'Shared identity',
					'concept',
					800,
					120,
					'cloud',
					'reviewer',
					'WorkOS is the identity target. The sign-in switch on this page is not OAuth.'
				),
				node(
					'agent-1',
					'Builder agent',
					'agent',
					800,
					320,
					'local',
					'builder',
					'Sample agent. The MCP panel returns a local simulation, not a live tool call.'
				)
			],
			edges: [
				{ id: 'e1', source: 'manef', target: 'mso', label: 'runs in' },
				{ id: 'e2', source: 'manef', target: 'diagram', label: 'mapped by' },
				{ id: 'e3', source: 'manef', target: 'github', label: 'versioned in' },
				{ id: 'e4', source: 'mso', target: 'decision-1', label: 'follows' },
				{ id: 'e5', source: 'diagram', target: 'context-1', label: 'holds context' },
				{ id: 'e6', source: 'github', target: 'vercel', label: 'deploys to' },
				{ id: 'e7', source: 'decision-1', target: 'workos', label: 'needs identity' },
				{ id: 'e8', source: 'context-1', target: 'agent-1', label: 'informs' },
				{ id: 'e9', source: 'vercel', target: 'agent-1', label: 'observed by' }
			]
		}
	};
}

function activity(text: string, type: string) {
	return {
		id: `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
		text,
		time: 'Just now',
		type
	};
}

export function installApp(state: WorkspaceState, appId: string): WorkspaceState {
	const app = catalog.find((item) => item.id === appId);
	if (!app || app.type !== 'managed' || state.apps.includes(appId)) return state;
	const id = `app-${appId}`;
	return {
		...state,
		apps: [...state.apps, appId],
		graph: {
			nodes: [
				...state.graph.nodes,
				node(
					id,
					app.name,
					'product',
					40 + state.apps.length * 24,
					520,
					'local',
					'operator',
					`${app.name} is installed in this demo only.`
				)
			],
			edges: [
				...state.graph.edges,
				{ id: `edge-${appId}`, source: 'mso', target: id, label: 'runs' }
			]
		},
		activities: [activity(`${app.name} installed in the demo.`, 'app'), ...state.activities].slice(
			0,
			24
		)
	};
}

export function uninstallApp(state: WorkspaceState, appId: string): WorkspaceState {
	const id = `app-${appId}`;
	if (!state.apps.includes(appId)) return state;
	return {
		...state,
		apps: state.apps.filter((item) => item !== appId),
		graph: {
			nodes: state.graph.nodes.filter((item) => item.id !== id),
			edges: state.graph.edges.filter((edge) => edge.source !== id && edge.target !== id)
		},
		activities: [activity(`${appId} removed from the demo.`, 'app'), ...state.activities].slice(
			0,
			24
		)
	};
}

export function connectService(
	state: WorkspaceState,
	serviceId: string,
	connected: boolean
): WorkspaceState {
	const known = connectorCatalog.some((item) => item.id === serviceId) || serviceId === 'n8n';
	if (!known) return state;
	const connections = { ...state.connections, [serviceId]: connected };
	const exists = state.graph.nodes.some((item) => item.id === serviceId);
	const service = connectorCatalog.find((item) => item.id === serviceId);
	const label = service ? `${service.name} · sample` : serviceId;
	const nodes = exists
		? state.graph.nodes.map((item) =>
				item.id === serviceId ? { ...item, status: connected ? 'active' : 'proposed' } : item
			)
		: [
				...state.graph.nodes,
				node(serviceId, label, 'service', 800, 480, 'cloud', 'operator', note)
			];
	return {
		...state,
		connections,
		graph: { ...state.graph, nodes },
		activities: [
			activity(
				`${serviceId} marked ${connected ? 'connected' : 'disconnected'} in the demo.`,
				'connection'
			),
			...state.activities
		].slice(0, 24)
	};
}

export function addContext(
	state: WorkspaceState,
	label: string,
	notes: string,
	kind = 'document'
): WorkspaceState {
	const clean = label.trim();
	if (!clean) return state;
	const id = `ctx-${state.graph.nodes.length + 1}`;
	return {
		...state,
		graph: {
			...state.graph,
			nodes: [
				...state.graph.nodes,
				node(id, clean, kind, 540, 520, 'web', 'builder', notes.trim() || note)
			],
			edges: [
				...state.graph.edges,
				{ id: `edge-${id}`, source: 'diagram', target: id, label: 'holds context' }
			]
		},
		activities: [
			activity(`Context “${clean}” added to the demo graph.`, 'context'),
			...state.activities
		].slice(0, 24)
	};
}

export function updateNotes(state: WorkspaceState, id: string, notes: string): WorkspaceState {
	return {
		...state,
		graph: {
			...state.graph,
			nodes: state.graph.nodes.map((item) => (item.id === id ? { ...item, notes } : item))
		}
	};
}

export function saveRouting(
	state: WorkspaceState,
	routing: WorkspaceState['routing']
): WorkspaceState {
	return {
		...state,
		routing,
		activities: [
			activity('Demo routing policy saved in this browser.', 'routing'),
			...state.activities
		].slice(0, 24)
	};
}

export function runDemoWorkflow(state: WorkspaceState): WorkspaceState {
	const id = `run-${state.runs.length + 1}`;
	const memory = node(
		`memory-${id}`,
		`Run ${state.runs.length + 1} memory`,
		'memory',
		40,
		560,
		'local',
		'operator',
		`Simulated run used ${state.routing.primary}, then ${state.routing.fallback}. No model was called.`
	);
	return {
		...state,
		runs: [...state.runs, { id, text: `Demo workflow finished with ${state.routing.policy}.` }],
		graph: {
			nodes: [...state.graph.nodes, memory],
			edges: [
				...state.graph.edges,
				{ id: `edge-${id}`, source: 'mso', target: memory.id, label: 'remembers' }
			]
		},
		activities: [
			activity('Demo workflow wrote a local memory node.', 'run'),
			...state.activities
		].slice(0, 24)
	};
}

export function addDomainPlan(state: WorkspaceState, host: string): WorkspaceState {
	const clean = host.trim();
	if (!clean) return state;
	const id = `domain-${state.domains.length + 1}`;
	return {
		...state,
		domains: [
			...state.domains,
			{ id, host: clean, note: 'Local plan only. No DNS change was made.' }
		],
		graph: {
			...state.graph,
			nodes: [
				...state.graph.nodes,
				node(
					id,
					clean,
					'deployment',
					800,
					520,
					'cloud',
					'operator',
					'Proposed in this demo. Not provisioned.'
				)
			],
			edges: [
				...state.graph.edges,
				{ id: `edge-${id}`, source: 'vercel', target: id, label: 'would host' }
			]
		},
		activities: [
			activity(`Deployment plan “${clean}” saved locally.`, 'ops'),
			...state.activities
		].slice(0, 24)
	};
}

export function simulateTool(state: WorkspaceState, tool: string, args: unknown) {
	if (!args || Array.isArray(args) || typeof args !== 'object')
		throw new Error('Arguments must be a JSON object.');
	const input = args as Record<string, unknown>;
	const meta = {
		simulation: true,
		persisted: false,
		source: 'local demo workspace; the public map uses the bundled seed'
	};
	const graph = state.graph;
	if (tool === 'graph_status') {
		return {
			...meta,
			tool,
			nodeCount: graph.nodes.length,
			edgeCount: graph.edges.length,
			workspace: state.workspace
		};
	}
	if (tool === 'graph_list_nodes') {
		const tag = typeof input.tag === 'string' ? input.tag : '';
		return { ...meta, tool, nodes: graph.nodes.filter((item) => !tag || item.tags.includes(tag)) };
	}
	if (tool === 'graph_list_edges') return { ...meta, tool, edges: graph.edges };
	if (tool === 'graph_trace') {
		const seeds = Array.isArray(input.seeds)
			? input.seeds.filter((item) => typeof item === 'string')
			: [];
		if (!seeds.length) throw new Error('seeds must be an array of strings.');
		const seen = new Set(seeds);
		const queue = [...seeds];
		while (queue.length) {
			const id = queue.shift()!;
			for (const edge of graph.edges) {
				const next = edge.source === id ? edge.target : edge.target === id ? edge.source : '';
				if (next && !seen.has(next)) {
					seen.add(next);
					if (input.mode !== 'direct') queue.push(next);
				}
			}
		}
		return { ...meta, tool, nodeIds: [...seen] };
	}
	if (tool === 'graph_layout')
		return { ...meta, tool, mode: input.mode === 'graph' ? 'graph' : 'flow' };
	if (tool === 'graph_search_inventory') {
		const query = String(input.query ?? '').toLowerCase();
		return {
			...meta,
			tool,
			matches: catalog.filter(
				(item) => item.name.toLowerCase().includes(query) || item.id.includes(query)
			)
		};
	}
	if (tool === 'graph_adjacency') {
		return {
			...meta,
			tool,
			adjacency: Object.fromEntries(
				graph.nodes.map((item) => [
					item.id,
					graph.edges.filter((edge) => edge.source === item.id).map((edge) => edge.target)
				])
			)
		};
	}
	if (tool === 'graph_query' || tool === 'graph_build_view') {
		const tags = Array.isArray(input.tags)
			? input.tags.filter((item) => typeof item === 'string')
			: [];
		return {
			...meta,
			tool,
			nodes: graph.nodes.filter((item) => tags.every((tag) => item.tags.includes(tag)))
		};
	}
	if (tool === 'graph_create_portable_view') {
		return { ...meta, tool, url: '/workspace/diagram?preview=1' };
	}
	throw new Error('Unknown tool.');
}

export function moveDemoNode(
	state: WorkspaceState,
	id: string,
	x: number,
	y: number
): WorkspaceState {
	if (!Number.isFinite(x) || !Number.isFinite(y)) return state;
	const nextX = Math.max(0, Math.min(1600, Math.round(x)));
	const nextY = Math.max(0, Math.min(1200, Math.round(y)));
	return {
		...state,
		graph: {
			...state.graph,
			nodes: state.graph.nodes.map((item) =>
				item.id === id ? { ...item, x: nextX, y: nextY } : item
			)
		}
	};
}

export function linkDemoNodes(
	state: WorkspaceState,
	source: string,
	target: string,
	label: string
): WorkspaceState {
	const clean = label.trim();
	if (!clean || source === target || state.graph.edges.length >= 80) return state;
	const known = new Set(state.graph.nodes.map((item) => item.id));
	if (!known.has(source) || !known.has(target)) return state;
	if (state.graph.edges.some((edge) => edge.source === source && edge.target === target))
		return state;
	return {
		...state,
		graph: {
			...state.graph,
			edges: [
				...state.graph.edges,
				{ id: `edge-${source}-${target}`, source, target, label: clean.slice(0, 40) }
			]
		}
	};
}

export function unlinkDemoEdge(state: WorkspaceState, id: string): WorkspaceState {
	return {
		...state,
		graph: { ...state.graph, edges: state.graph.edges.filter((edge) => edge.id !== id) }
	};
}

export function renameDemoEdge(state: WorkspaceState, id: string, label: string): WorkspaceState {
	const clean = label.trim();
	if (!clean) return state;
	return {
		...state,
		graph: {
			...state.graph,
			edges: state.graph.edges.map((edge) =>
				edge.id === id ? { ...edge, label: clean.slice(0, 40) } : edge
			)
		}
	};
}

export function toggleReview(state: WorkspaceState, id: string): WorkspaceState {
	const reviews = state.reviews ?? [];
	return {
		...state,
		reviews: reviews.includes(id) ? reviews.filter((item) => item !== id) : [...reviews, id]
	};
}

export function filterDemoNodes(
	nodes: DemoNode[],
	query: string,
	facets: Record<string, string[]>
): DemoNode[] {
	const needle = query.trim().toLowerCase();
	const groups = Object.values(facets).filter((tags) => tags.length > 0);
	return nodes.filter((item) => {
		const hay = `${item.label} ${item.notes} ${item.tags.join(' ')}`.toLowerCase();
		if (needle && !hay.includes(needle)) return false;
		return groups.every((tags) => tags.some((tag) => item.tags.includes(tag)));
	});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function replaceDemoGraph(state: WorkspaceState, input: unknown): WorkspaceState {
	if (!isRecord(input) || !isRecord(input.graph)) {
		throw new Error('Import must be an object with a graph.');
	}
	const rawNodes = input.graph.nodes;
	const rawEdges = input.graph.edges;
	if (!Array.isArray(rawNodes) || !Array.isArray(rawEdges)) {
		throw new Error('Graph nodes and edges must be arrays.');
	}
	if (rawNodes.length > 40 || rawEdges.length > 80)
		throw new Error('Graph is larger than the demo limit.');
	const nodes: DemoNode[] = [];
	const seen = new Set<string>();
	for (const item of rawNodes) {
		if (!isRecord(item)) throw new Error('Each node must be an object.');
		const id = typeof item.id === 'string' ? item.id.trim() : '';
		const label = typeof item.label === 'string' ? item.label.trim() : '';
		if (!/^[a-z0-9-]{1,40}$/i.test(id) || !label || label.length > 80) {
			throw new Error('A node has an invalid id or label.');
		}
		if (seen.has(id)) throw new Error('Node ids must be unique.');
		seen.add(id);
		const x = Number(item.x);
		const y = Number(item.y);
		const tags = Array.isArray(item.tags)
			? item.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 12)
			: [];
		nodes.push({
			id,
			label,
			kind: typeof item.kind === 'string' ? item.kind.slice(0, 24) : 'node',
			x: Number.isFinite(x) ? Math.max(0, Math.min(1600, Math.round(x))) : 40,
			y: Number.isFinite(y) ? Math.max(0, Math.min(1200, Math.round(y))) : 40,
			platform: typeof item.platform === 'string' ? item.platform.slice(0, 24) : 'web',
			agent: typeof item.agent === 'string' ? item.agent.slice(0, 24) : 'builder',
			project: typeof item.project === 'string' ? item.project.slice(0, 40) : 'launch-demo',
			status: typeof item.status === 'string' ? item.status.slice(0, 24) : 'active',
			notes: typeof item.notes === 'string' ? item.notes.slice(0, 500) : note,
			tags: tags.map((tag) => tag.slice(0, 40))
		});
	}
	const edges: DemoEdge[] = [];
	const pairs = new Set<string>();
	for (const item of rawEdges) {
		if (!isRecord(item)) throw new Error('Each edge must be an object.');
		const source = typeof item.source === 'string' ? item.source : '';
		const target = typeof item.target === 'string' ? item.target : '';
		const label = typeof item.label === 'string' ? item.label.trim() : '';
		if (!seen.has(source) || !seen.has(target) || source === target || !label) {
			throw new Error('An edge is invalid.');
		}
		const pair = `${source}>${target}`;
		if (pairs.has(pair)) continue;
		pairs.add(pair);
		const id =
			typeof item.id === 'string' && /^[a-z0-9-]{1,48}$/i.test(item.id)
				? item.id
				: `e${edges.length + 1}`;
		edges.push({ id, source, target, label: label.slice(0, 40) });
	}
	let nextNodes = nodes;
	let nextEdges = edges;
	for (const appId of state.apps) {
		const id = `app-${appId}`;
		if (nextNodes.some((item) => item.id === id)) continue;
		const app = catalog.find((item) => item.id === appId);
		nextNodes = [
			...nextNodes,
			node(
				id,
				app?.name ?? appId,
				'product',
				40,
				520,
				'local',
				'operator',
				`${app?.name ?? appId} stays installed in this demo.`
			)
		];
		if (nextNodes.some((item) => item.id === 'mso')) {
			nextEdges = [...nextEdges, { id: `edge-${appId}`, source: 'mso', target: id, label: 'runs' }];
		}
	}
	return {
		...state,
		graph: { nodes: nextNodes, edges: nextEdges },
		activities: [
			activity('Demo graph replaced from a local import.', 'graph'),
			...state.activities
		].slice(0, 24)
	};
}
