import { MCP_SERVER_ENABLED, MCP_SERVER_TOKEN } from '$app/env/private';
import { PUBLIC_SITE_URL } from '$app/env/public';
import { error } from '@sveltejs/kit';
import { consumeBurst, matchesSecret, readJsonBody, requireAppOrigin } from '#lib/server/access.js';
import { statusMcpResponse } from '#lib/server/mcp/server.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	if (MCP_SERVER_ENABLED !== 'true') error(404, 'MCP server is disabled.');

	const token = MCP_SERVER_TOKEN;

	if (!token || token.length < 32 || token.length > 4096)
		error(503, 'MCP server setup is incomplete.');
	if (!matchesSecret(request.headers.get('authorization') ?? '', `Bearer ${token}`))
		error(401, 'MCP authorization required.');
	if (request.headers.has('origin')) requireAppOrigin(request, PUBLIC_SITE_URL);

	consumeBurst(`mcp-server:${token}`);
	const body = await readJsonBody(request);
	try {
		return await statusMcpResponse(request, body, PUBLIC_SITE_URL);
	} catch {
		error(500, 'MCP request could not be processed.');
	}
};
