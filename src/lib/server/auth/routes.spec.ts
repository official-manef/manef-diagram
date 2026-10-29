import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { POST as token } from '../../../routes/auth/token/+server';
import { POST as logout } from '../../../routes/auth/logout/+server';
import { GET as callback } from '../../../routes/auth/callback/+server';
import { authConfiguration, establishSession } from './session';

const { privateEnv, publicEnv } = vi.hoisted(() => ({
	privateEnv: {} as Record<string, string>,
	publicEnv: { PUBLIC_SITE_URL: 'https://app.example.com' } as Record<string, string>
}));
// SvelteKit 3 replaced $env/dynamic/* with declared vars in $app/env/*. Getters keep the
// specs able to change values between assertions.
vi.mock('$app/env/private', () => ({
	get AI_ENABLED() {
		return (privateEnv.AI_ENABLED ?? '') as string;
	},
	get AI_MODELS_JSON() {
		return (privateEnv.AI_MODELS_JSON ?? '') as string;
	},
	get MCP_CLIENT_ENABLED() {
		return (privateEnv.MCP_CLIENT_ENABLED ?? '') as string;
	},
	get MCP_SERVERS_JSON() {
		return (privateEnv.MCP_SERVERS_JSON ?? '') as string;
	},
	get MCP_SERVER_ENABLED() {
		return (privateEnv.MCP_SERVER_ENABLED ?? '') as string;
	},
	get MCP_SERVER_TOKEN() {
		return (privateEnv.MCP_SERVER_TOKEN ?? '') as string;
	},
	get CAPABILITY_ACCESS_TOKEN() {
		return (privateEnv.CAPABILITY_ACCESS_TOKEN ?? '') as string;
	},
	get AUTH_ENABLED() {
		return (privateEnv.AUTH_ENABLED ?? '') as string;
	},
	get AUTH_PROVIDER() {
		return (privateEnv.AUTH_PROVIDER ?? '') as string;
	},
	get AUTH_CLIENT_ID() {
		return (privateEnv.AUTH_CLIENT_ID ?? '') as string;
	},
	get AUTH_CLIENT_SECRET() {
		return (privateEnv.AUTH_CLIENT_SECRET ?? '') as string;
	},
	get AUTH_SESSION_SECRET() {
		return (privateEnv.AUTH_SESSION_SECRET ?? '') as string;
	},
	get WORKOS_CLIENT_ID() {
		return (privateEnv.WORKOS_CLIENT_ID ?? '') as string;
	},
	get WORKOS_API_KEY() {
		return (privateEnv.WORKOS_API_KEY ?? '') as string;
	}
}));
vi.mock('$app/env/public', () => ({
	get PUBLIC_CONVEX_URL() {
		return (publicEnv.PUBLIC_CONVEX_URL ?? '') as string;
	},
	get PUBLIC_SITE_URL() {
		return (publicEnv.PUBLIC_SITE_URL ?? '') as string;
	},
	get PUBLIC_SEO_INDEXABLE() {
		return (publicEnv.PUBLIC_SEO_INDEXABLE ?? '') as string;
	},
	get PUBLIC_GOOGLE_SITE_VERIFICATION() {
		return (publicEnv.PUBLIC_GOOGLE_SITE_VERIFICATION ?? '') as string;
	},
	get PUBLIC_BING_SITE_VERIFICATION() {
		return (publicEnv.PUBLIC_BING_SITE_VERIFICATION ?? '') as string;
	},
	get PUBLIC_TWITTER_SITE() {
		return (publicEnv.PUBLIC_TWITTER_SITE ?? '') as string;
	}
}));

function event<Route extends '/auth/token' | '/auth/logout' | '/auth/callback'>(
	path: Route,
	origin = publicEnv.PUBLIC_SITE_URL,
	body: unknown = {},
	search = ''
) {
	const values = new Map<string, string>();
	const url = new URL(path + search, publicEnv.PUBLIC_SITE_URL);
	const get = path.startsWith('/auth/callback');
	return {
		url,
		request: new Request(
			url,
			get
				? {}
				: {
						method: 'POST',
						headers: { origin, 'content-type': 'application/json' },
						body: JSON.stringify(body)
					}
		),
		setHeaders: vi.fn(),
		cookies: {
			get: (name: string) => values.get(name),
			set: (name: string, value: string) => values.set(name, value),
			delete: (name: string) => values.delete(name)
		}
	} as unknown as RequestEvent<Record<string, never>, Route>;
}

beforeEach(() => {
	Object.assign(privateEnv, {
		AUTH_ENABLED: 'true',
		AUTH_CLIENT_ID: 'test-client',
		AUTH_CLIENT_SECRET: 'test-secret',
		AUTH_SESSION_SECRET: Buffer.alloc(32, 7).toString('base64url')
	});
});

test('token and sign-out reject cross-origin requests, including requests with no Origin', async () => {
	await expect(token(event('/auth/token', 'https://attacker.example'))).rejects.toMatchObject({
		status: 403
	});
	expect(() => logout(event('/auth/logout', 'https://attacker.example'))).toThrow();
	await expect(token(event('/auth/token', ''))).rejects.toMatchObject({ status: 403 });
});

test('token responses are uncached and release only an ID token to a same-origin signed-in browser', async () => {
	const current = event('/auth/token');
	const config = authConfiguration();
	if (!config.enabled) throw new Error('Test auth disabled.');
	await establishSession(current, config, {
		subject: 'member',
		idToken: 'test-id-token',
		idTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
		refreshToken: 'private-refresh'
	});
	const response = await token(current);
	expect(response.headers.get('cache-control')).toBe('no-store');
	expect(await response.json()).toEqual({ idToken: 'test-id-token' });
	await expect(
		token(event('/auth/token', undefined, { forceRefreshToken: 'yes' }))
	).rejects.toMatchObject({ status: 400 });
	await expect(token(event('/auth/token', undefined, { unknown: true }))).rejects.toMatchObject({
		status: 400
	});
});

test('disabled auth and callbacks without a login transaction fail closed', async () => {
	await expect(
		callback(event('/auth/callback', undefined, {}, '?code=unexpected&state=unexpected'))
	).rejects.toMatchObject({ status: 400 });
	privateEnv.AUTH_ENABLED = 'false';
	await expect(token(event('/auth/token'))).rejects.toMatchObject({ status: 404 });
});

test('an account switch in another tab cannot supply its token to the previous page identity', async () => {
	const config = authConfiguration();
	if (!config.enabled) throw new Error('Test auth disabled.');
	const expectedTokenIdentifier = 'https://accounts.google.com|alice';
	const alice = event('/auth/token', undefined, { expectedTokenIdentifier });
	await establishSession(alice, config, {
		subject: 'alice',
		idToken: 'alice-token',
		idTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600
	});
	expect(await (await token(alice)).json()).toEqual({ idToken: 'alice-token' });
	await establishSession(alice, config, {
		subject: 'bob',
		idToken: 'bob-token',
		idTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600
	});
	const stalePage = event('/auth/token', undefined, { expectedTokenIdentifier });
	Object.assign(stalePage, { cookies: alice.cookies });
	const response = await token(stalePage);
	expect(response.headers.get('cache-control')).toBe('no-store');
	expect(await response.json()).toEqual({ idToken: null });
	const currentPage = event('/auth/token', undefined, {
		expectedTokenIdentifier: 'https://accounts.google.com|bob'
	});
	Object.assign(currentPage, { cookies: alice.cookies });
	expect(await (await token(currentPage)).json()).toEqual({ idToken: 'bob-token' });
});

test.each([null, false, '', 42, 'x'.repeat(2049)])(
	'rejects invalid expected page identity %s',
	async (expectedTokenIdentifier) => {
		await expect(
			token(event('/auth/token', undefined, { expectedTokenIdentifier }))
		).rejects.toMatchObject({ status: 400 });
	}
);
