import { defineEnvVars } from '@sveltejs/kit/env';

// SvelteKit 3 replaces `$env/dynamic/*` with explicit declarations here, imported from
// `$app/env/public` or `$app/env/private`. Unset values stay '' so the existing config guards
// (truthiness checks per variable) keep deciding what is enabled.
// @migration-task Review usage of dynamic environment variables. They fall back to the empty string if not present, which may not be what you want.
export const variables = defineEnvVars({
	PUBLIC_CONVEX_URL: { public: true, schema: (input) => input ?? '' },
	PUBLIC_SITE_URL: { public: true, schema: (input) => input ?? '' },
	PUBLIC_SEO_INDEXABLE: { public: true, schema: (input) => input ?? '' },
	PUBLIC_GOOGLE_SITE_VERIFICATION: { public: true, schema: (input) => input ?? '' },
	PUBLIC_BING_SITE_VERIFICATION: { public: true, schema: (input) => input ?? '' },
	PUBLIC_TWITTER_SITE: { public: true, schema: (input) => input ?? '' },
	AI_ENABLED: { schema: (input) => input ?? '' },
	AI_MODELS_JSON: { schema: (input) => input ?? '' },
	MCP_CLIENT_ENABLED: { schema: (input) => input ?? '' },
	MCP_SERVERS_JSON: { schema: (input) => input ?? '' },
	MCP_SERVER_ENABLED: { schema: (input) => input ?? '' },
	MCP_SERVER_TOKEN: { schema: (input) => input ?? '' },
	CAPABILITY_ACCESS_TOKEN: { schema: (input) => input ?? '' },
	AUTH_ENABLED: { schema: (input) => input ?? '' },
	AUTH_PROVIDER: { schema: (input) => input ?? '' },
	AUTH_CLIENT_ID: { schema: (input) => input ?? '' },
	AUTH_CLIENT_SECRET: { schema: (input) => input ?? '' },
	AUTH_SESSION_SECRET: { schema: (input) => input ?? '' },
	WORKOS_CLIENT_ID: { schema: (input) => input ?? '' },
	WORKOS_API_KEY: { schema: (input) => input ?? '' }
});
