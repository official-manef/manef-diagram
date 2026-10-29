import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import {
	consumeBurst,
	matchesSecret,
	readJsonBody,
	requireAppOrigin,
	requireCapabilityAccess
} from './access';

const state = vi.hoisted(() => ({
	env: {} as Record<string, string>,
	publicEnv: { PUBLIC_SITE_URL: 'https://app.example' } as Record<string, string>,
	session: vi.fn()
}));
// SvelteKit 3 replaced $env/dynamic/* with declared vars in $app/env/*. Getters keep the
// specs able to change values between assertions.
vi.mock('$app/env/private', () => ({
	get AI_ENABLED() {
		return (state.env.AI_ENABLED ?? '') as string;
	},
	get AI_MODELS_JSON() {
		return (state.env.AI_MODELS_JSON ?? '') as string;
	},
	get MCP_CLIENT_ENABLED() {
		return (state.env.MCP_CLIENT_ENABLED ?? '') as string;
	},
	get MCP_SERVERS_JSON() {
		return (state.env.MCP_SERVERS_JSON ?? '') as string;
	},
	get MCP_SERVER_ENABLED() {
		return (state.env.MCP_SERVER_ENABLED ?? '') as string;
	},
	get MCP_SERVER_TOKEN() {
		return (state.env.MCP_SERVER_TOKEN ?? '') as string;
	},
	get CAPABILITY_ACCESS_TOKEN() {
		return (state.env.CAPABILITY_ACCESS_TOKEN ?? '') as string;
	},
	get AUTH_ENABLED() {
		return (state.env.AUTH_ENABLED ?? '') as string;
	},
	get AUTH_PROVIDER() {
		return (state.env.AUTH_PROVIDER ?? '') as string;
	},
	get AUTH_CLIENT_ID() {
		return (state.env.AUTH_CLIENT_ID ?? '') as string;
	},
	get AUTH_CLIENT_SECRET() {
		return (state.env.AUTH_CLIENT_SECRET ?? '') as string;
	},
	get AUTH_SESSION_SECRET() {
		return (state.env.AUTH_SESSION_SECRET ?? '') as string;
	},
	get WORKOS_CLIENT_ID() {
		return (state.env.WORKOS_CLIENT_ID ?? '') as string;
	},
	get WORKOS_API_KEY() {
		return (state.env.WORKOS_API_KEY ?? '') as string;
	}
}));
vi.mock('$app/env/public', () => ({
	get PUBLIC_CONVEX_URL() {
		return (state.publicEnv.PUBLIC_CONVEX_URL ?? '') as string;
	},
	get PUBLIC_SITE_URL() {
		return (state.publicEnv.PUBLIC_SITE_URL ?? '') as string;
	},
	get PUBLIC_SEO_INDEXABLE() {
		return (state.publicEnv.PUBLIC_SEO_INDEXABLE ?? '') as string;
	},
	get PUBLIC_GOOGLE_SITE_VERIFICATION() {
		return (state.publicEnv.PUBLIC_GOOGLE_SITE_VERIFICATION ?? '') as string;
	},
	get PUBLIC_BING_SITE_VERIFICATION() {
		return (state.publicEnv.PUBLIC_BING_SITE_VERIFICATION ?? '') as string;
	},
	get PUBLIC_TWITTER_SITE() {
		return (state.publicEnv.PUBLIC_TWITTER_SITE ?? '') as string;
	}
}));
vi.mock('#lib/server/auth/session.js', () => ({ readSession: state.session }));
beforeEach(() => {
	state.env.CAPABILITY_ACCESS_TOKEN = '';
	state.session.mockReset().mockResolvedValue(null);
});

test('access secrets and origins reject missing, different and unsafe values', () => {
	expect(matchesSecret('secret', 'secret')).toBe(true);
	expect(matchesSecret('secret', 'secret-longer')).toBe(false);
	expect(matchesSecret('', '')).toBe(false);
	const request = new Request('https://app.example/api', {
		headers: { origin: 'https://app.example' }
	});
	expect(() => requireAppOrigin(request, 'https://app.example')).not.toThrow();
	for (const origin of [undefined, 'https://app.example/path', 'http://app.example'])
		expect(() => requireAppOrigin(request, origin)).toThrow();
	expect(() => requireAppOrigin(new Request(request.url), 'https://app.example')).toThrow();
});

test('JSON reader checks actual UTF-8 bytes, JSON and media type', async () => {
	const request = (body: BodyInit, type = 'application/json') =>
		new Request('https://app.example/api', {
			method: 'POST',
			headers: { 'content-type': type },
			body
		});
	await expect(readJsonBody(request('{"ok":true}'))).resolves.toEqual({ ok: true });
	await expect(readJsonBody(request('"é"'), 3)).rejects.toMatchObject({ status: 413 });
	await expect(readJsonBody(request(new Uint8Array([0xff])))).rejects.toMatchObject({
		status: 400
	});
	await expect(readJsonBody(request('{'))).rejects.toMatchObject({ status: 400 });
	await expect(readJsonBody(request('{}', 'text/plain'))).rejects.toMatchObject({ status: 415 });
});

test('capability access requires a session or configured operator token and same origin', async () => {
	const event = (token = '', origin = 'https://app.example') =>
		({
			request: new Request('https://app.example/api', {
				method: 'POST',
				headers: { origin, authorization: `Bearer ${token}` }
			})
		}) as RequestEvent;
	await expect(requireCapabilityAccess(event())).rejects.toMatchObject({ status: 401 });
	state.env.CAPABILITY_ACCESS_TOKEN = 'x'.repeat(32);
	await expect(requireCapabilityAccess(event('x'.repeat(32)))).resolves.toBeUndefined();
	await expect(
		requireCapabilityAccess(event('x'.repeat(32), 'https://evil.example'))
	).rejects.toMatchObject({ status: 403 });
	state.session.mockResolvedValue({ tokenIdentifier: 'https://issuer.example|one' });
	await expect(requireCapabilityAccess(event())).resolves.toBeUndefined();
});

test('burst protection is isolated by identity and expires', () => {
	const id = crypto.randomUUID();
	const now = Date.now();
	for (let i = 0; i < 20; i++) consumeBurst(id, now);
	expect(() => consumeBurst(id, now)).toThrow();
	expect(() => consumeBurst(`${id}-other`, now)).not.toThrow();
	expect(() => consumeBurst(id, now + 60_000)).not.toThrow();
});
