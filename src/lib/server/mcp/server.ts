import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import packageJson from '../../../../package.json';
import {
	defaultGraph,
	defaultInventory,
	GRAPH_TOOL_NAMES,
	runGraphTool,
	type GraphToolName
} from '$features/architecture-inventory';

const readOnly = {
	readOnlyHint: true,
	destructiveHint: false,
	idempotentHint: true,
	openWorldHint: false
} as const;

const toolInputs: Record<GraphToolName, { description: string; inputSchema: z.ZodTypeAny }> = {
	graph_status: {
		description:
			'Read the MANEF architecture graph identity and its current node/edge counts. Read-only.',
		inputSchema: z.object({}).strict()
	},
	graph_list_nodes: {
		description:
			'List all nodes in the MANEF public architecture graph, optionally filtered by tag or status. Read-only.',
		inputSchema: z
			.object({
				tag: z.string().optional(),
				status: z.enum(['active', 'proposed', 'private']).optional()
			})
			.strict()
	},
	graph_list_edges: {
		description: 'List all connections (edges) in the MANEF architecture graph. Read-only.',
		inputSchema: z.object({}).strict()
	},
	graph_trace: {
		description:
			'Trace the graph from one or more seed node ids, returning the connected nodes and edges. mode "direct" returns immediate neighbors; "component" returns the whole connected component. Read-only.',
		inputSchema: z
			.object({
				seeds: z.array(z.string()).min(1).max(50),
				mode: z.enum(['direct', 'component']).default('component')
			})
			.strict()
	},
	graph_layout: {
		description:
			'Compute node positions for the MANEF architecture graph in "flow" or "graph" layout mode. Read-only.',
		inputSchema: z.object({ mode: z.enum(['flow', 'graph']).default('flow') }).strict()
	},
	graph_search_inventory: {
		description:
			'Search the MANEF architecture inventory for items that can be materialized into the graph. Read-only.',
		inputSchema: z.object({ query: z.string().default('') }).strict()
	},
	graph_adjacency: {
		description: 'Return the adjacency map of the MANEF architecture graph. Read-only.',
		inputSchema: z.object({}).strict()
	},
	graph_query: {
		description:
			'Query the MANEF context graph by free text, namespaced facets and status. Tags in one namespace are OR-ed; namespaces are AND-ed. Returns the matching bounded subgraph and a navigable view URL. Read-only.',
		inputSchema: z
			.object({
				query: z.string().max(200).default(''),
				tags: z.array(z.string().max(100)).max(30).default([]),
				status: z.enum(['active', 'proposed', 'private']).optional()
			})
			.strict()
	},
	graph_build_view: {
		description:
			'Build a navigable diagram.manef.dev URL for the bundled context graph with search, facet, seed, layout, trace and focus state. Read-only.',
		inputSchema: z
			.object({
				query: z.string().max(200).default(''),
				tags: z.array(z.string().max(100)).max(30).default([]),
				seeds: z.array(z.string().max(200)).max(30).default([]),
				mode: z.enum(['flow', 'graph']).default('graph'),
				trace: z.enum(['direct', 'component']).default('component'),
				focus: z.boolean().default(false)
			})
			.strict()
	},
	graph_create_portable_view: {
		description:
			'Validate a bounded MANEF graph supplied by any agent/client and return a stateless navigable diagram.manef.dev URL. This does not persist or mutate server data.',
		inputSchema: z
			.object({
				graph: z.unknown(),
				query: z.string().max(200).default(''),
				tags: z.array(z.string().max(100)).max(30).default([]),
				seeds: z.array(z.string().max(200)).max(30).default([]),
				mode: z.enum(['flow', 'graph']).default('graph'),
				trace: z.enum(['direct', 'component']).default('component'),
				focus: z.boolean().default(false)
			})
			.strict()
	}
};

export async function statusMcpResponse(request: Request, parsedBody: unknown) {
	const server = new McpServer({ name: packageJson.name, version: packageJson.version });
	for (const name of GRAPH_TOOL_NAMES) {
		const spec = toolInputs[name];
		server.registerTool(
			name,
			{ description: spec.description, inputSchema: spec.inputSchema, annotations: readOnly },
			async (args: unknown) => {
				const input =
					args && typeof args === 'object' && !Array.isArray(args)
						? (args as Record<string, unknown>)
						: {};
				const value = runGraphTool(defaultGraph, defaultInventory, name, input);
				const body =
					name === 'graph_status'
						? { name: packageJson.name, version: packageJson.version, ...((value ?? {}) as object) }
						: value;
				return { content: [{ type: 'text' as const, text: JSON.stringify(body) }] };
			}
		);
	}

	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true
	});
	try {
		await server.connect(transport);
		const response = await transport.handleRequest(request, { parsedBody });
		const bytes = response.body ? await response.arrayBuffer() : null;
		const headers = new Headers(response.headers);
		headers.set('Cache-Control', 'no-store');
		return new Response(bytes, { status: response.status, headers });
	} finally {
		await server.close();
	}
}
