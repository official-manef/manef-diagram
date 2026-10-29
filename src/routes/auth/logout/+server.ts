import { redirect } from '@sveltejs/kit';
import { requireAppOrigin } from '#lib/server/access.js';
import { clearSession, configuredAuth } from '#lib/server/auth/session.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = (event) => {
	const config = configuredAuth();
	requireAppOrigin(event.request, config.origin);
	clearSession(event, config);
	event.setHeaders({ 'cache-control': 'no-store' });
	redirect(303, '/');
};
