export type Product = {
	id: string;
	name: string;
	eyebrow: string;
	color: string;
	status: string;
	level: 'external' | 'source' | 'proposed';
	headline: string;
	description: string;
	domain: string;
	live?: string;
	features: string[];
	truth: string;
};

export const products: Product[] = [
	{
		id: 'mso',
		name: 'MSO',
		eyebrow: 'RUN YOUR WORK',
		color: 'lime',
		status: 'Existing product',
		level: 'external',
		headline: 'A home for your tools. A trail for your work.',
		description: 'A modular shell for apps, agents, and the context of the work.',
		domain: 'mso.manef.dev',
		live: 'https://mso.manef.dev',
		features: [
			'App launcher and runtime',
			'Workflow and session',
			'Work memory',
			'Install through a reviewed adapter'
		],
		truth:
			'Linked as an active product from MANEF. The MSO repo and runtime were not re-audited in this package.'
	},
	{
		id: 'diagram',
		name: 'Diagram',
		eyebrow: 'CONNECT THE CONTEXT',
		color: 'blue',
		status: 'Source + deployment',
		level: 'source',
		headline: 'Not another canvas. A map that agents can use.',
		description: 'Navigate products, decisions, tools, and context sources on one graph.',
		domain: 'diagram.manef.dev',
		live: 'https://diagram.manef.dev/app',
		features: [
			'Flow and graph editing',
			'Project, platform, and kind facets',
			'MCP tools in source',
			'Portable views'
		],
		truth:
			'The public map is the live diagram. An audit on 3 Oct 2026 saw commit f9cb57aa. Later revisions made that map readable. Agent-write persistence and sign-in acceptance are still open.'
	},
	{
		id: 'registry',
		name: 'App Catalog',
		eyebrow: 'DISCOVER & EXTEND',
		color: 'purple',
		status: 'Catalog v1 in source',
		level: 'source',
		headline: 'A small core. A world of connected apps.',
		description:
			'Find a reviewed app, read the example permissions, then connect it to the MSO demo.',
		domain: 'manef.dev/catalog/v1.json',
		live: 'https://manef.dev/catalog/v1.json',
		features: ['Hermes', 'OpenClaw', '9Router', 'n8n connection template'],
		truth:
			'Four entries exist in the MANEF catalog JSON. The catalog is metadata, not install commands. The installer stays with MSO.'
	},
	{
		id: 'connectors',
		name: 'Connectors',
		eyebrow: 'BRING YOUR STACK',
		color: 'orange',
		status: 'Proposed product surface',
		level: 'proposed',
		headline: 'Connect once. Keep permissions explicit.',
		description: 'A proposed place to review connections, scopes, and tool use across products.',
		domain: 'connectors.manef.dev · proposed',
		features: [
			'Connection inventory',
			'Scope review',
			'Per-product access',
			'Revocation and audit trail'
		],
		truth:
			'A standalone Connectors dashboard was not found as a shipped MANEF app. This page is a demo of that proposal.'
	},
	{
		id: 'models',
		name: 'Models',
		eyebrow: 'CHOOSE HOW AI RUNS',
		color: 'pink',
		status: 'Proposed product surface',
		level: 'proposed',
		headline: 'Your models. Your routing. Your rules.',
		description:
			'A proposal for provider routing, fallback, and which product may use which model.',
		domain: 'models.manef.dev · proposed',
		features: [
			'Provider routing',
			'Fallback policy',
			'Local or cloud choice',
			'Per-product assignments'
		],
		truth:
			'No MANEF model API or billing backend is claimed here. Saving a policy only updates this browser.'
	},
	{
		id: 'ops',
		name: 'Operations',
		eyebrow: 'SEE WHAT IS RUNNING',
		color: 'teal',
		status: 'Proposed product surface',
		level: 'proposed',
		headline: 'Every product. A clear operational picture.',
		description:
			'A proposal for deployments, domains, and runtime status with the evidence next to the label.',
		domain: 'ops.manef.dev · proposed',
		features: [
			'Deployment inventory',
			'Environment boundaries',
			'Domain mapping',
			'Evidence-first status'
		],
		truth:
			'Two production targets were READY on Vercel when audited. An Ops monitoring product is design, not a live monitor.'
	},
	{
		id: 'docs',
		name: 'Developer Docs',
		eyebrow: 'BUILD WITH MANEF',
		color: 'blue',
		status: 'Proposed unified portal',
		level: 'proposed',
		headline: 'Clear contracts. Portable integrations.',
		description: 'A proposed portal for the registry, MCP, identity, and integration contracts.',
		domain: 'docs.manef.dev · proposed',
		features: [
			'MCP playground',
			'Contract documentation',
			'Navigation map',
			'Implementation audit'
		],
		truth:
			'Repository docs exist. A unified docs host at this subdomain was not verified as a deployment.'
	},
	{
		id: 'labs',
		name: 'Labs',
		eyebrow: 'EXPLORE WHAT IS NEXT',
		color: 'purple',
		status: 'Concept / roadmap',
		level: 'proposed',
		headline: 'Room to experiment. Without muddying production.',
		description:
			'A separate lane for the next product direction and prototypes that can be reviewed.',
		domain: 'labs.manef.dev · proposed',
		features: [
			'Experiment registry',
			'Review queue',
			'Clear maturity labels',
			'No production claims'
		],
		truth: 'Labs is a roadmap. This page is not a catalog of released products.'
	}
];

export const principles = [
	[
		'01',
		'Modular',
		'Each product can ship on its own. The shell only shares labels, identity, and the graph contract.'
	],
	[
		'02',
		'Interoperable',
		'Catalog metadata does not become an install command. Adapters stay reviewed.'
	],
	['03', 'Operable', 'A status without evidence stays a proposal. Audit rows keep their source.'],
	['04', 'Portable', 'A shared view is a link, not an access list and not a database.']
];

export const auditRows: [string, string, string, string, string, string][] = [
	[
		'MANEF',
		'Production deployment',
		'verified',
		'Vercel production READY at the 3 Oct 2026 audit, SHA 2fad0eb8.',
		'Vercel API',
		'Visual production of manef.dev was not rechecked in that audit.'
	],
	[
		'MANEF',
		'Product navigation',
		'source',
		'The homepage then listed MSO, App Catalog, and Integration Layer. Diagram was missing from that product array.',
		'home-canvas.tsx at 2fad0eb8',
		'This diagram site now has the directory. manef.dev was not changed.'
	],
	[
		'MANEF',
		'Shared SSO portal',
		'gap',
		'No shared workspace or auth route was found on the MANEF app tree that was inspected.',
		'app tree at 2fad0eb8',
		'Do not treat this demo shell as SSO.'
	],
	[
		'MANEF',
		'Catalog v1',
		'source',
		'Three managed ids and one n8n connection template.',
		'public/catalog/v1.json',
		'Browse, install, health, update, and uninstall are not proven end to end.'
	],
	[
		'Diagram',
		'Production deployment',
		'verified',
		'diagram.manef.dev is the Vercel origin. The 3 Oct audit matched f9cb57aa.',
		'Vercel + GitHub',
		'READY did not prove sign-in or owner isolation.'
	],
	[
		'Diagram',
		'Public map',
		'source',
		'The bundled seed is the public service list. Private inventory stays off that seed.',
		'CONTRACT.md',
		'Demo workspace nodes are browser-local and are not that seed.'
	],
	[
		'Diagram',
		'MCP tools',
		'source',
		'Ten tools are registered in source. Portable creation stays stateless.',
		'src/lib/server/mcp/server.ts',
		'Live tool execution still needs a token. This playground does not call it.'
	],
	[
		'Diagram',
		'Sign-in',
		'partial',
		'WorkOS is the target. Google OIDC remains a compatibility adapter.',
		'docs/workos-login.md',
		'Consent, callback, refresh, and owner-isolated notes are still an acceptance gate.'
	],
	[
		'Ecosystem',
		'Models, Connectors, Ops, Labs',
		'proposed',
		'These surfaces are navigation proposals, not extra production hosts.',
		'This prototype',
		'Ship the contract before calling the subdomain live.'
	],
	[
		'Ecosystem',
		'MSO',
		'unverified',
		'Linked from MANEF as an existing product. Its repo was not re-audited here.',
		'mso.manef.dev',
		'Needs its own audit before an install adapter is treated as real.'
	]
];

export const roadmap = [
	{
		id: 'identity',
		priority: 'P0',
		title: 'Accept WorkOS and Convex end to end',
		description: 'Sign-in, refresh, logout, and two-user isolation.',
		product: 'Identity'
	},
	{
		id: 'navigation',
		priority: 'P0',
		title: 'Keep Diagram on the MANEF portal',
		description: 'Directory, switcher, and a hard line between the public map and the demo.',
		product: 'Portal'
	},
	{
		id: 'agent-write',
		priority: 'P1',
		title: 'Authorized graph writes',
		description: 'Scope, provenance, idempotency, and an audit log.',
		product: 'Diagram'
	},
	{
		id: 'lifecycle',
		priority: 'P1',
		title: 'Finish the MSO app lifecycle',
		description: 'Reviewed permissions, installer, health, update, uninstall.',
		product: 'Catalog'
	},
	{
		id: 'support',
		priority: 'P1',
		title: 'AIRIN acceptance on MANEF',
		description: 'Visitor to agent to inbox to human, on desktop and phone.',
		product: 'Support'
	},
	{
		id: 'route-model',
		priority: 'P2',
		title: 'Unify routing and connectors',
		description: 'Per-workspace grants, fallback, and observability.',
		product: 'Ecosystem'
	}
];

export const guideSections = [
	{ id: 'start', title: 'Start' },
	{ id: 'navigation', title: 'Navigation' },
	{ id: 'identity', title: 'Identity' },
	{ id: 'mcp', title: 'MCP' },
	{ id: 'catalog', title: 'Catalog' }
] as const;
