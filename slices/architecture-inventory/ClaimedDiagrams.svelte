<script lang="ts">
	import { page } from '$app/state';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { ConvexError } from 'convex/values';
	import { api } from '../../src/convex/_generated/api';
	import type { Id } from '../../src/convex/_generated/dataModel';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { ArchitectureGraph } from './types';

	let {
		onOpen
	}: {
		onOpen: (graph: ArchitectureGraph, name: string) => void;
	} = $props();

	const client = useConvexClient();
	const signedIn = $derived(Boolean(page.data.auth?.session));
	const snapshots = useQuery(api.architecture.list, { limit: 20 });
	let pendingId = $state<Id<'architectureSnapshots'> | null>(null);
	let failure = $state('');

	function errorText(cause: unknown) {
		return cause instanceof ConvexError && typeof cause.data === 'object' && cause.data?.message
			? String(cause.data.message)
			: 'The claimed diagram could not be changed. Try again.';
	}

	async function open(id: Id<'architectureSnapshots'>) {
		if (pendingId) return;
		pendingId = id;
		failure = '';
		try {
			const row = await client.query(api.architecture.get, { id });
			if (!row) throw new Error('This claimed diagram is no longer in your account.');
			onOpen(row.graph, row.name);
		} catch (cause) {
			failure = cause instanceof Error ? cause.message : errorText(cause);
		} finally {
			pendingId = null;
		}
	}

	async function remove(id: Id<'architectureSnapshots'>) {
		if (pendingId || !window.confirm('Delete this claimed diagram? This cannot be undone.')) return;
		pendingId = id;
		failure = '';
		try {
			await client.mutation(api.architecture.remove, { id });
		} catch (cause) {
			failure = errorText(cause);
		} finally {
			pendingId = null;
		}
	}
</script>

{#if signedIn}
	<details class="claim-panel">
		<summary
			>Claimed diagrams {#if snapshots.data}({snapshots.data.length}){/if}</summary
		>
		{#if snapshots.isLoading}
			<p class="claim-note">Loading your claimed diagrams…</p>
		{:else if snapshots.error}
			<p class="claim-error" role="alert">
				Your claimed diagrams could not be loaded. Check your connection and sign-in.
			</p>
		{:else if !snapshots.data || snapshots.data.length === 0}
			<p class="claim-note">
				Open a shared diagram link and choose “Claim this diagram” to keep it here.
			</p>
		{:else}
			<ul class="claim-list">
				{#each snapshots.data as snapshot (snapshot._id)}
					<li>
						<button
							type="button"
							class="claim-open"
							disabled={pendingId === snapshot._id}
							onclick={() => void open(snapshot._id).catch(() => undefined)}
						>
							<strong>{snapshot.name}</strong>
							<small>{new Date(snapshot.updatedAt).toLocaleDateString()}</small>
						</button>
						<Button
							size="sm"
							variant="ghost"
							aria-label={`Delete ${snapshot.name}`}
							disabled={pendingId === snapshot._id}
							onclick={() => void remove(snapshot._id).catch(() => undefined)}>Remove</Button
						>
					</li>
				{/each}
			</ul>
		{/if}
		{#if failure}<p class="claim-error" role="alert">{failure}</p>{/if}
	</details>
{/if}
