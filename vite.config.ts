import vercel from '@sveltejs/adapter-vercel';
import node from '@sveltejs/adapter-node';
import cloudflare from '@sveltejs/adapter-cloudflare';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

function deploymentAdapter() {
	const target = process.env.DEPLOY_TARGET ?? 'vercel';

	switch (target) {
		case 'vercel':
			// The build host may run Node 26, which adapter-vercel refuses to guess a runtime for.
			// package.json engines pins 22/24; Vercel functions run 22 until the engines floor moves.
			return vercel({ runtime: 'nodejs22.x' });

		case 'node':
			return node();

		case 'cloudflare':
			return cloudflare({ platformProxy: { environment: 'pilot' } });

		default:
			throw new Error(`Unsupported DEPLOY_TARGET "${target}". Choose vercel, node or cloudflare.`);
	}
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// New app code is always Svelte 5 Runes. Dependencies keep their own mode.
				runes: ({ filename }) =>
					filename?.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: deploymentAdapter(),
			// adapter-node v6 dropped the ORIGIN env var; this is the SvelteKit 3 replacement.
			// Only the trusted public origin is accepted, matching PUBLIC_SITE_URL.
			...(process.env.ORIGIN ? { paths: { origin: process.env.ORIGIN } } : {}),
			alias: { $features: './slices' }
		})
	],
	// SvelteKit merges its own allowlist; root feature slices also need client dev access.
	server: { fs: { allow: ['slices'] } },
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}', 'slices/**/*.{test,spec}.{js,ts}'],
					exclude: ['**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
