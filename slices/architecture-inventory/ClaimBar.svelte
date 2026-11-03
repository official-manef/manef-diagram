<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useConvexClient } from 'convex-svelte';
	import { ConvexError } from 'convex/values';
	import { api } from '../../src/convex/_generated/api';
	import { Button } from '#lib/components/ui/button/index.js';
	import { claimName } from './lib/claim';
	import type { ArchitectureGraph } from './types';

	let {
		graph,
		title,
		onClaimed
	}: {
		graph: ArchitectureGraph;
		title: string | undefined;
		onClaimed: () => void;
	} = $props();

	const client = useConvexClient();
	const signedIn = $derived(Boolean(page.data.auth?.session));
	let pending = $state(false);
	let failure = $state('');

	async function claim() {
		if (pending) return;
		pending = true;
		failure = '';
		const name = claimName(title, graph);
		try {
			await client.mutation(api.architecture.save, { name, graph });
			onClaimed();
		} catch (cause) {
			failure =
				cause instanceof ConvexError && typeof cause.data === 'object' && cause.data?.message
					? String(cause.data.message)
					: 'The diagram could not be claimed. Check your connection and try again.';
		} finally {
			pending = false;
		}
	}
</script>

<div class="claim-bar">
	{#if signedIn}
		<Button size="sm" variant="outline" onclick={claim} disabled={pending}>
			{pending ? 'Claiming…' : 'Claim this diagram'}
		</Button>
		<span class="claim-note">Save this shared diagram into your account.</span>
	{:else}
		<a class="claim-signin" href={resolve('/auth/login')} data-sveltekit-reload
			>Sign in to claim this diagram</a
		>
	{/if}
	{#if failure}<p class="claim-error" role="alert">{failure}</p>{/if}
</div>
