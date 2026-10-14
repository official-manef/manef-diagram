<script lang="ts">
	import { publicNavigation } from '$lib/config/navigation';
	import { siteLinks } from '$lib/config/navigation';
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

<div class="eco studio" class:landing={path === '/'} data-theme={themePreference.theme}>
	<header class="public-header">
		<a class="brand" href={resolve('/')}>Manef Diagram</a>
		<nav class="public-nav" aria-label="Public">
			{#each publicNavigation as item (item.href)}
				{#if item.external}
					<a href={item.href} rel="external">{item.label} ↗</a>
				{:else}
					<a
						href={resolve(item.href)}
						aria-current={path === item.href ||
						(item.href === '/products' && path.startsWith('/products/'))
							? 'page'
							: undefined}>{item.label}</a
					>
				{/if}
			{/each}
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
			{:else if page.data.auth?.enabled}
				<a class="btn primary" href={resolve('/auth/login')} data-sveltekit-reload
					>Sign in with MANEF</a
				>
			{:else}
				<span class="muted">Public map · no account needed</span>
			{/if}
		</div>
	</header>
	{@render children()}
	<footer class="public-footer">
		<span>Manef Diagram · Architecture maps. The ecosystem workspace lives at MANEF.</span>
		<a href={siteLinks.ecosystemOrigin} rel="external">MANEF ecosystem ↗</a>
	</footer>
</div>
