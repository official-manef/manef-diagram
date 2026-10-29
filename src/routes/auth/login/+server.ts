import { error, redirect } from '@sveltejs/kit';
import { beginAuthorization } from '#lib/server/auth/oidc.js';
import { configuredAuth, saveTransaction } from '#lib/server/auth/session.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const config = configuredAuth();
	if (event.url.origin !== config.origin)
		error(400, 'Open sign-in on the configured application URL.');
	const { url, transaction } = await beginAuthorization(config);
	await saveTransaction(event, config, transaction);
	event.setHeaders({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
	// The provider origin is external to this app; SvelteKit 3 requires an allowlist for that.
	redirect(303, url.href, { external: [url.origin] });
};
