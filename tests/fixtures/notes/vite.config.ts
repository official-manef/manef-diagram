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
		alias: {
			$features: local('../../../slices'),
			$lib: local('../../../src/lib'),
			'$app/state': local('./page.svelte.ts'),
			'$app/env': local('./environment.ts'),
			'$app/env/public': local('./environment.ts'),
			'convex/browser': local('./client.svelte.ts')
		},
		dedupe: ['svelte']
	},
	server: { host: '127.0.0.1', port: 4198, strictPort: true, fs: { allow: [local('../../../')] } }
});
