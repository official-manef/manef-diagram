import { AI_ENABLED, AI_MODELS_JSON, MCP_CLIENT_ENABLED, MCP_SERVERS_JSON } from '$app/env/private';
import { error, json } from '@sveltejs/kit';
import { requireCapabilityAccess } from '#lib/server/access.js';
import { aiSettings } from '#lib/server/ai/config.js';
import { mcpConnections } from '#lib/server/mcp/config.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	if (AI_ENABLED === 'true' || MCP_CLIENT_ENABLED === 'true') await requireCapabilityAccess(event);

	try {
		return json(
			{
				ai: aiSettings({ AI_ENABLED, AI_MODELS_JSON }),
				mcp: {
					enabled: MCP_CLIENT_ENABLED === 'true',
					servers: mcpConnections({ MCP_CLIENT_ENABLED, MCP_SERVERS_JSON }).map(({ alias }) => ({
						alias
					}))
				}
			},
			{ headers: { 'Cache-Control': 'no-store' } }
		);
	} catch {
		error(503, 'Assistant setup is incomplete. Check the private server configuration.');
	}
};
