import vercel from '@sveltejs/adapter-vercel';
import node from '@sveltejs/adapter-node';
import cloudflare from '@sveltejs/adapter-cloudflare';

function deploymentAdapter() {
	const target = process.env.DEPLOY_TARGET ?? 'vercel';
	switch (target) {
		case 'vercel':
			return vercel();
		case 'node':
			return node();
		case 'cloudflare':
			return cloudflare({ platformProxy: { environment: 'pilot' } });
		default:
			throw new Error(`Unsupported DEPLOY_TARGET "${target}". Choose vercel, node or cloudflare.`);
	}
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// New app code is always Svelte 5 Runes. Dependencies keep their own mode.
		runes: ({ filename }) => (filename?.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: deploymentAdapter(),
		alias: {
			$features: './slices'
		}
	}
};

export default config;
