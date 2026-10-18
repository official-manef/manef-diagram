import { error, json } from '@sveltejs/kit';
import { readJsonBody, requireAppOrigin } from '$lib/server/access';
import { configuredAuth, getConvexToken } from '$lib/server/auth/session';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const config = configuredAuth();
	requireAppOrigin(event.request, config.origin);
	const body = await readJsonBody(event.request, 4096);
	if (
		!body ||
		typeof body !== 'object' ||
		Array.isArray(body) ||
		Object.keys(body).some(
			(key) => key !== 'forceRefreshToken' && key !== 'expectedTokenIdentifier'
		) ||
		('expectedTokenIdentifier' in body &&
			(typeof body.expectedTokenIdentifier !== 'string' ||
				!body.expectedTokenIdentifier ||
				body.expectedTokenIdentifier.length > 2048)) ||
		('forceRefreshToken' in body && typeof body.forceRefreshToken !== 'boolean')
	)
		error(400, 'Send an optional boolean forceRefreshToken and expectedTokenIdentifier string.');
	const idToken = await getConvexToken(event, body);
	return json({ idToken }, { headers: { 'cache-control': 'no-store', pragma: 'no-cache' } });
};
