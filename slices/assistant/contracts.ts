export type AiProvider = 'openai' | 'anthropic' | 'google';
export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type AssistantSettings = {
	ai: { enabled: boolean; providers: { id: AiProvider; label: string; models: string[] }[] };
	mcp: { enabled: boolean; servers: { alias: string }[] };
};
export type ToolListing = {
	name: string;
	description?: string;
	inputSchema: Record<string, unknown>;
};
export type ChatEvent =
	{ type: 'text'; text: string } | { type: 'error'; message: string } | { type: 'done' };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate a setup response before reactive consumers can read its lists. */
export function isAssistantSettings(value: unknown): value is AssistantSettings {
	if (
		!isRecord(value) ||
		!isRecord(value.ai) ||
		typeof value.ai.enabled !== 'boolean' ||
		!Array.isArray(value.ai.providers) ||
		!isRecord(value.mcp) ||
		typeof value.mcp.enabled !== 'boolean' ||
		!Array.isArray(value.mcp.servers)
	)
		return false;
	const providers = value.ai.providers;
	const servers = value.mcp.servers;
	return (
		providers.every(
			(provider: unknown) =>
				isRecord(provider) &&
				typeof provider.id === 'string' &&
				['openai', 'anthropic', 'google'].includes(provider.id) &&
				typeof provider.label === 'string' &&
				Array.isArray(provider.models) &&
				provider.models.every((model: unknown) => typeof model === 'string' && model.length > 0)
		) &&
		new Set(providers.map((provider: Record<string, unknown>) => provider.id)).size ===
			providers.length &&
		servers.every(
			(server: unknown) =>
				isRecord(server) && typeof server.alias === 'string' && server.alias.length > 0
		) &&
		new Set(servers.map((server: Record<string, unknown>) => server.alias)).size === servers.length
	);
}

export function isToolListings(value: unknown): value is ToolListing[] {
	return (
		Array.isArray(value) &&
		value.every(
			(tool: unknown) =>
				isRecord(tool) &&
				typeof tool.name === 'string' &&
				tool.name.length > 0 &&
				(tool.description === undefined || typeof tool.description === 'string') &&
				isRecord(tool.inputSchema)
		) &&
		new Set(value.map((tool: Record<string, unknown>) => tool.name)).size === value.length
	);
}
