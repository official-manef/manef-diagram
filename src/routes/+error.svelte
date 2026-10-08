<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
</script>

<main class="grid min-h-dvh w-full place-items-center p-6">
	<div class="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 text-left">
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
