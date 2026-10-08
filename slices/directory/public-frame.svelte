<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { themePreference } from './theme.svelte';
	import '$lib/styles/ecosystem.css';

	let { children }: { children: import('svelte').Snippet } = $props();
	const path = $derived(page.url.pathname);
	const session = $derived(page.data.auth?.session);

	onMount(() => themePreference.init());
</script>

<div class="eco" data-theme={themePreference.theme}>
	<header class="public-header">
		<a class="brand" href={resolve('/')}>MANEF</a>
		<nav class="public-nav" aria-label="Public">
			<a
				href={resolve('/products')}
				aria-current={path.startsWith('/products') ? 'page' : undefined}>Products</a
			>
			<a href={resolve('/guide')} aria-current={path === '/guide' ? 'page' : undefined}>Guide</a>
			<a href={resolve('/audit')} aria-current={path === '/audit' ? 'page' : undefined}>Audit</a>
			<a href={resolve('/workspace')}>Workspace</a>
		</nav>
		<div class="row">
			<button
				class="btn small"
				type="button"
				onclick={() =>
					themePreference.setTheme(themePreference.theme === 'dark' ? 'light' : 'dark')}
			>
				{themePreference.theme === 'dark' ? 'Light' : 'Dark'}
			</button>
			<a class="btn" href={resolve('/app')}>Open diagram</a>
			{#if session}
				<span class="muted">Signed in as {session.email ?? session.subject}</span>
				<form method="POST" action="/auth/logout">
					<button class="btn primary" type="submit">Sign out</button>
				</form>
			{:else}
				<a class="btn primary" href={resolve('/auth/login')} data-sveltekit-reload
					>Sign in with MANEF</a
				>
			{/if}
		</div>
	</header>
	{@render children()}
	<footer class="public-footer">
		<span>Public map and a labeled demo. Proposals are not live hosts.</span>
		<a href={resolve('/audit')}>Read the audit</a>
	</footer>
</div>
