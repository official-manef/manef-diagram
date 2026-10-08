<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
</script>

<main class="error-page">
	<p class="brand">MANEF Architecture</p>
	<div class="panel">
		<p class="text-sm font-medium text-muted-foreground">{page.status}</p>
		<h1 class="text-2xl font-semibold">{page.error?.message ?? 'Something went wrong'}</h1>
		<p class="text-sm text-muted-foreground">
			{#if page.status === 404}
				This address is not part of the public MANEF map.
			{:else}
				The page failed to load. Nothing on the map was changed.
			{/if}
		</p>
		<div class="flex flex-wrap gap-2">
			<Button href="/">Back to home</Button>
			<Button href="/app" variant="outline">Open diagram</Button>
			{#if page.status >= 500}
				<Button variant="outline" onclick={() => window.location.reload()}>Reload page</Button>
			{/if}
		</div>
		{#if page.error?.id}
			<details class="text-xs text-muted-foreground">
				<summary>Support reference</summary>
				<p class="mt-2 break-all">{page.error.id}</p>
			</details>
		{/if}
	</div>
</main>

<style>
	.error-page {
		display: flex;
		min-height: 100dvh;
		flex-direction: column;
		gap: 1.25rem;
		background: var(--background);
		padding: 2rem 1.25rem 3rem;
	}
	.brand {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.panel {
		display: grid;
		width: min(100%, 36rem);
		gap: 0.85rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg, 0.75rem);
		background: var(--card);
		padding: 1.5rem;
	}
</style>
