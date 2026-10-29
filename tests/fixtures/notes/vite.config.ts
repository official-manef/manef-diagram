import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
	root: local('./'),
	optimizeDeps: { exclude: ['convex-svelte', 'convex'] },
	plugins: [
		svelte({
			configFile: false,
			compilerOptions: {
				runes: ({ filename }) => (filename?.includes('node_modules') ? undefined : true)
			}
		})
	],
	resolve: {
		alias: [
			// Order matters: the exact modules win over the `$app/env` prefix below.
			{ find: '$app/env/public', replacement: local('./environment.ts') },
			{ find: '$app/env/private', replacement: local('./environment.ts') },
			{ find: '$app/env', replacement: local('./environment.ts') },
			{ find: '$features', replacement: local('../../../slices') },
			{ find: '$lib', replacement: local('../../../src/lib') },
			{ find: '#lib', replacement: local('../../../src/lib') },
			{ find: '$app/state', replacement: local('./page.svelte.ts') },
			{ find: 'convex/browser', replacement: local('./client.svelte.ts') }
		],
		dedupe: ['svelte']
	},
	server: { host: '127.0.0.1', port: 4198, strictPort: true, fs: { allow: [local('../../../')] } }
});
